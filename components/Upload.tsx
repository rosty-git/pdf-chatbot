import { Container, Input, Text, FormElement, Table, Button, Loading } from "@nextui-org/react"
import { ChangeEvent, useCallback, useEffect, useState } from "react"
import { useSupabaseClient } from "@supabase/auth-helpers-react"
import { Delete } from "react-iconly"

type UploadedFile = {
    id: number,
    filename: string,
    userId: string
}

export default function Upload() {
    
    const supabase = useSupabaseClient()

    
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
    const [files, setFiles] = useState<FileList | null>(null)
    const [status, setStatus] = useState("")
    const [uploading, setUploading] = useState(false)
    const [reloading, setReloading] = useState(false)

    const reloadUploadedFiles = useCallback(() => {
        setReloading(true)
        supabase
            .from("files")
            .select("*")
            .then(({ data }) => {
                setUploadedFiles((data as UploadedFile[]) || [])
                setReloading(false)
            })
    }, [supabase])

    useEffect(() => {
        reloadUploadedFiles()

        supabase.channel("files")
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'files' },
                (payload) => {
                    if (payload.eventType === "INSERT") {
                        setUploadedFiles([...uploadedFiles, payload.new as UploadedFile])
                        setReloading(false)
                    } else {
                        reloadUploadedFiles()
                    }
                }
            )
            .subscribe()
    }, [reloadUploadedFiles, supabase])

    const handleFilesChange = (e: ChangeEvent<FormElement>) => {
        if ('files' in e.target)
            setFiles(e.target.files)
    }

    const uploadFiles = async () => {
        if (!files) return
        
        const formData = new FormData()
        for (let i = 0; i < files.length; i++) {
            formData.append("pdfFiles", files[i])
        }

        try {
            setUploading(true)
            setReloading(true)
            const response = await fetch("api/", {
                method: "POST",
                body: formData
            })
            const { message } = await response.json()
            setStatus(message)

        } catch(e) {
            console.log(e)
            setStatus("An error ocurred while uploading your files.")
        } finally {
            setUploading(false)
            setReloading(false)
        }
    }

    const deleteFile = async (filename: string) => {
        setReloading(true)
        await supabase
            .from("files")
            .delete()
            .eq("filename", filename)
        

        await supabase.rpc('delete_documents_by_source', {
            source: filename
        })
    }

    return (
        <Container css={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "150px"}}>
            {!uploadedFiles || !uploadedFiles.length ? (
                reloading ? (
                    <Loading />
                ) : (
                    <Text css={{ textAlign: "center" }}>No uploaded files</Text>
                )
            ) : (
                <Table aria-label="uploaded files">
                    <Table.Header>
                        <Table.Column>File name</Table.Column>
                        <Table.Column>Action</Table.Column>
                    </Table.Header>
                    <Table.Body>
                        {uploadedFiles.map((uf, i) => (
                            <Table.Row key={i}>
                                <Table.Cell>
                                    <Text key={i}>{uf.filename}</Text>
                                </Table.Cell>
                                <Table.Cell>
                                    <Button
                                        auto
                                        icon={<Delete set="bold" primaryColor="blueviolet"/>}
                                        css={{ backgroundColor: "transparent" }}
                                        onPress={e => deleteFile(uf.filename)}
                                    />
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            )}
            
            <Container css={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center" }}>
                <Input
                    css={{ width: "100%", "label": { width: "100%", cursor: "pointer", border: "$primaryBorder solid 1px" } }}
                    hidden
                    disabled={uploading}
                    type="file"
                    multiple
                    aria-label="upload"
                    onChange={handleFilesChange}
                    accept=".pdf"
                />
                <Text css={{ position: "absolute", pointerEvents: "none" }}>
                    {files && files.length ? (
                        [...files].map(f => f.name).join("; ")
                    ) : (
                        "Click to select your files"
                    )}
                </Text>
            </Container>

            <Button
                disabled={!files || !files.length || uploading}
                icon={uploading ? <Loading /> : null}
                onPress={uploadFiles}
            >
                Upload
            </Button>
            <Text>{status}</Text>
        </Container>
    )
}