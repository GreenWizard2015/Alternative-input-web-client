import { NextApiRequest, NextApiResponse } from 'next';

// Basic implementation of a multipart form data parser
class MultipartParser {
  constructor(boundary) {
    this.boundary = `--${boundary}`;
    this.buffers = [];
    this.lookForHeaders = true;
    this.headers = {};
  }

  // A method to process the incoming stream data
  async parse(stream) {
    for await (const chunk of stream) {
      let chunkStr = chunk.toString();
      if (this.lookForHeaders) {
        const idx = chunkStr.indexOf(this.boundary);
        if (-1 < idx) {
          this.buffers.push(chunk);
          this.lookForHeaders = false;
          continue;
        }
        // Further header or metadata parsing logic can be added here
      } else {
        this.buffers.push(chunk);
      }
    }
  }

  body() {
    const res = Buffer.concat(this.buffers).toString('binary');
    const start = res.indexOf('\r\n\r\n') + 4;
    const end = res.lastIndexOf('\r\n' + this.boundary);
    return res.slice(start, end);
  }

  getBuffer() {
    const res = this.body();
    if (res.includes(this.boundary)) {
      throw new Error('Invalid boundary found in the data');
    }
    // wrap to ArrayBuffer
    const ab = new ArrayBuffer(res.length);
    const v = new DataView(ab);
    for (let i = 0; i < res.length; ++i) {
      v.setUint8(i, res.charCodeAt(i));
    }
    return ab;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!req.headers['content-type']?.startsWith('multipart/form-data')) {
    return res.status(400).json({ error: 'Unsupported content type' });
  }

  const boundary = req.headers['content-type'].split('boundary=')[1];
  console.log("Boundary: ", boundary);
  if (!boundary) {
    return res.status(400).json({ error: 'No boundary found for multipart data' });
  }
  const parser = new MultipartParser(boundary);
  try {
    await parser.parse(req);

    const fileData = parser.getBuffer();
    console.log("Received file data: ", fileData.byteLength);
    const fd = new FormData();
    fd.append('chunk', new Blob([fileData]));

    const url = process.env.SAVE_ENDPOINT;
    const response = await fetch(url, {
      method: 'POST',
      body: fd,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.text();
    console.log("Server response: ", data);
    res.status(200).json({ message: 'Upload successful' });
  } catch (error) {
    console.error("Error processing the upload:", error);
    res.status(500).json({ message: 'Failed to process upload', error: error.message });
  }
}

export const config = {
  api: {
    bodyParser: false,
    sizeLimit: '128mb',
  },
};