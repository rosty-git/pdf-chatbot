import { NextApiRequest, NextApiResponse } from "next";
import { createServerSupabaseClient } from "@supabase/auth-helpers-nextjs";
// @ts-ignore
import * as pdfjs from "pdf.js-extract/lib/pdfjs/pdf.js"

// @ts-ignore
import * as pdfjsWorker from "pdf.js-extract/lib/pdfjs/pdf.worker.js"
pdfjsWorker

pdfjs.GlobalWorkerOptions.workerSrc = "pdf.js-extract/lib/pdfjs/pdf.worker.js"

import { PDFExtract } from 'pdf.js-extract'

import nc from "next-connect"
import multer from "multer"

import path from 'node:path';
import fs from "fs"
import { promisify } from "util";


const unlinkAsync = promisify(fs.unlink)

const upload = multer({
    storage: multer.diskStorage({
        filename: (req, file, cb) => cb(null, file.originalname),
    })
})

const apiRoute = nc<NextApiRequest, NextApiResponse>({
    onNoMatch(req, res) {
        res.status(405).json({ error: "Only POST requests allowed"} )
    }
})

apiRoute.post(upload.array("pdfFiles"), async (req, res) => {
    
    const pdfExtract = new PDFExtract()
    
    if (!req.files) {
        res.status(400).json({ error: "No files uploaded" })
        return
    }
    
    let results: { pageContent: string, metadata: {} }[]

    if (Array.isArray(req.files)) {

        results = await Promise.all(req.files.map(async file => {
            const filePath = path.join(file.destination, file.filename)
            const pdfData = await pdfExtract.extract(filePath)
            
            unlinkAsync(filePath)
            return {
                pageContent: pdfData.pages.map(page => page.content.map(p => p.str).join(" ")).join("\n\n"),
                metadata: {
                    source: file.filename
                }
            }
        }))

    } else {
        res.status(400).json({ error: "Expected array of files with one name" })
        return
    }

    const supabase = createServerSupabaseClient({ req, res }, {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    })
    const { data, error } = await supabase.functions.invoke("upload-pdf", {
        body: {
            documents: results
        }
    })

    if (error) {
        console.error(error)
        res.status(400).json(error)
        return
    }

    res.status(200).json(data)
})

export default apiRoute;

export const config = {
    api: {
        bodyParser: false
    }
}