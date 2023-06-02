import { Container, Input, Row, Button, Text, PressEvent, Spacer, Loading } from "@nextui-org/react"
import { useEffect, useState } from "react"
import { Send } from "react-iconly"
import { useSupabaseClient } from "@supabase/auth-helpers-react"

type MsgProps = {
    text: string,
    sender: "user" | "chatbot" | "system"
}

const Msg = ({ text, sender }: MsgProps) => {
    let flexFlow
    let backgroundColor
    let justifyContent

    switch (sender) {
        case "user":
            flexFlow = "row"
            backgroundColor = "$primary"
            break;
        case "chatbot":
            flexFlow = "row-reverse"
            backgroundColor = "$green500"
            break;
        case "system":
            flexFlow = "row"
            backgroundColor = "$secondary"
            justifyContent = "center"
        break;
    }

    return (
        <Row css={{ display: "flex", flexFlow, justifyContent}}>
            <Spacer y={2} />
            <Text css={{ backgroundColor, p: 6, borderRadius: 5 }} >{text}</Text>
        </Row>
    )
}


export default function Chat() {

    const [loading, setLoading] = useState(false)

    const welcomeMsg: MsgProps = {
        text: "This is the begining of your chat",
        sender: "system"
    }

    const [messages, setMessages] = useState<MsgProps[]>([welcomeMsg])
    const [msg, setMsg] = useState<MsgProps | null>(null)

    const supabase = useSupabaseClient()

    useEffect(() => {
        const el = document.getElementById("messages-container")
        if (!el) return

        el.scrollTo(0, el.scrollHeight);
    }, [messages])

    const sendMessage = async () => {
        if (!msg) return
        
        const message = msg
        
        setMessages([...messages, msg])
        setMsg(null)
        setLoading(true)
        
        const { data, error } = await supabase.functions.invoke("chat", {
            body: { message: message.text }
        })

        if (error) {
            setMessages([...messages, msg, {text: "An error occured", sender: "system"}])
            setLoading(false)
            return
        }

        setMessages([...messages, msg, {text: data["text"], sender: "chatbot"}])

        setLoading(false)
    }

    return (
        <Container css={{ border: "$primaryBorder solid 2px", borderRadius: "15px", p: 5 }} >
            <Container id="messages-container" css={{ height: "200px",  overflowY: "scroll", p: 4 }}>
                {messages.map((msg, i) => <Msg key={i} {...msg} />)}
            </Container>
            <Container>
                <Row css={{ display: "flex", justifyContent: "left" }}>
                    <Input
                        bordered
                        disabled={loading}
                        type="text"
                        aria-label="message"
                        placeholder="Send message"
                        value={msg?.text || ""}
                        onChange={e => setMsg({text: e.target.value, sender: "user"})}
                        enterKeyHint="send"
                        onKeyUp={e => e.key == "Enter" ? sendMessage() : null}
                    />
                    <Button
                        disabled={loading}
                        auto
                        icon={loading ? <Loading /> : <Send set="broken" primaryColor="blue" />}
                        css={{ backgroundColor: "transparent" }}
                        onPress={sendMessage}
                    />
                </Row>
            </Container>
        </Container>
    )
}