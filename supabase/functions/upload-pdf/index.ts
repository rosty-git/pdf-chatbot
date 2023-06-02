// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { SupabaseVectorStore } from "langchain/vectorstores/supabase"
import { OpenAIEmbeddings } from "langchain/embeddings/openai"
import { Document } from "langchain/document"
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"

import { createClient } from "../_shared/supabaseClient.ts"
import { corsHeaders } from "../_shared/cors.ts"


const embeddings = new OpenAIEmbeddings()

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 700,
  separators: ["\n\n", "\n", ";", "."]
})


serve(async (req) => {

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const { documents }: { documents: { pageContent: string, metadata: Record<string, unknown> }[] } = await req.json()


  const client = createClient(req)
  const { data: { user }} = await client.auth.getUser()

  if (!user) {
    return new Response(
      JSON.stringify({error: "Please login"}),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401
      },
    )
  }

  let docs = documents.map(doc => new Document({pageContent: doc.pageContent, metadata: doc.metadata}))
  
  docs.forEach(doc => {
    doc.metadata = {...doc.metadata, user: user.id}
  })

  docs = await textSplitter.splitDocuments(docs)

  const vectorStore = new SupabaseVectorStore(embeddings, {
    client,
    tableName: "documents",
    queryName: "match_documents",
  })

  
  await vectorStore.addDocuments(docs)
  
  const toInsert = documents.map(doc => ({ user_id: user.id, filename: doc.metadata["source"] }))
  const { data, error } = await client.from("files").insert(toInsert)

  return new Response(
    JSON.stringify({ message: "Success", data, error }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  )
})

// To invoke:
// curl -i --location --request POST 'http://localhost:54321/functions/v1/' \
//   --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
//   --header 'Content-Type: application/json' \
//   --data '{"name":"Functions"}'
