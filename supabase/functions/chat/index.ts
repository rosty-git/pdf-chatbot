// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "http/server.ts"
import { ChatOpenAI } from "langchain/chat_models/openai"
import { OpenAIEmbeddings } from "langchain/embeddings/openai"
import { SupabaseVectorStore  } from "langchain/vectorstores/supabase"
import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from "langchain/prompts"
import { LLMChain } from "langchain/chains"
import { Document } from "langchain/document"

import { createClient } from "../_shared/supabaseClient.ts"
import { corsHeaders } from "../_shared/cors.ts";


const embeddings = new OpenAIEmbeddings()

const llm = new ChatOpenAI({modelName: "gpt-3.5-turbo"})

const chatPrompt = ChatPromptTemplate.fromPromptMessages([
  SystemMessagePromptTemplate.fromTemplate(
    `You are a chatbot having a conversation with a human.

    Given the following extracted parts of a long document and some unsorted but relevant previous chat messages, answer the users question.
    DO NOT explain documents from chat history.
    Make sure to include source of your information if there is one.
    If there are no documents simply inform the user.

    Docs: {docs}
    Chat: {chatHistory}
    `
  ),
  HumanMessagePromptTemplate.fromTemplate("{message}")
])

const chain = new LLMChain({
  prompt: chatPrompt,
  llm,
})

serve(async (req) => {

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const { message } = await req.json()

  const client = createClient(req)

  const { data: {user} } = await client.auth.getUser()

  const docsStore = new SupabaseVectorStore(embeddings, {
    client,
    tableName: "documents",
    queryName: "match_documents"
  })

  const msgStore = new SupabaseVectorStore(embeddings, {
    client,
    tableName: "messages",
    queryName: "match_messages",
  })

  const docs = await docsStore.similaritySearch(message)
  const messages = await msgStore.similaritySearch(message, 20)

  const result = await chain.call({
    message,
    docs: docs.map(doc => `${doc.pageContent} source: ${doc.metadata["source"]}`).join(";"),
    chatHistory: messages.map(doc => `${doc.metadata["source"]}: ${doc.pageContent}`).join("\n")
  })

  msgStore.addDocuments([
    new Document({ pageContent: message, metadata: { source: "Human", user: user!.id } }),
    new Document({ pageContent: result["text"], metadata: { source: "AI", user: user!.id } })
  ])

  return new Response(
    JSON.stringify(result),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  )
})

// To invoke:
// curl -i --location --request POST 'http://localhost:54321/functions/v1/' \
//   --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
//   --header 'Content-Type: application/json' \
//   --data '{"name":"Functions"}'
