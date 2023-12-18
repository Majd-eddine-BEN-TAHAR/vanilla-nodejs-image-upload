// Import necessary modules from Node.js standard library
const http = require("http"); // HTTP server functionalities
const fs = require("fs"); // File system operations
const path = require("path"); // File path utilities
const { promisify } = require("util"); // Utility to convert callback-based functions to promises
const fileType = require("file-type");

// Convert fs.writeFile, fs.mkdir, and fs.exists to their promise-based counterparts
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);
const existsAsync = promisify(fs.exists);

// Define the directory where uploads will be stored
const UPLOADS_DIR = path.join(__dirname, "uploads"); // Combine current directory with 'uploads' folder
const PORT = 3000; // Port number for the HTTP server
const MAX_FILE_SIZE = 5 * 1024 * 1024; // Max file size set to 5MB

// Ensure that the uploads directory exists
async function ensureUploadsDir() {
  if (!(await existsAsync(UPLOADS_DIR))) {
    // Check if the directory exists
    await mkdirAsync(UPLOADS_DIR); // Create the directory if it does not exist
  }
}

// Execute the function and catch any errors
ensureUploadsDir().catch(console.error);

// Create an HTTP server
const server = http.createServer(async (req, res) => {
  // Handle HTTP GET requests
  if (req.method === "GET") {
    serveForm(req, res); // Serve the HTML form for file upload
  }
  // Handle HTTP POST requests
  else if (req.method === "POST") {
    try {
      // Process the file upload
      await handleFileUpload(req, res);
    } catch (error) {
      // Log and respond to the client in case of an error
      console.error(error);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
  }
  // Respond with 405 Method Not Allowed for other HTTP methods
  else {
    res.statusCode = 405;
    res.end("Method Not Allowed");
  }
});

// Start listening on the defined port
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Function to serve the HTML form for file upload
function serveForm(req, res) {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(`
        <form action="/" method="post" enctype="multipart/form-data">
            <input type="file" name="fileupload">
            <input type="submit" value="Upload">
        </form>
    `);
}

// Asynchronous function to handle file uploads
async function handleFileUpload(req, res) {
  // Check if the uploaded file exceeds the size limit
  if (req.headers["content-length"] > MAX_FILE_SIZE) {
    // Respond with 413 Payload Too Large if it does
    res.writeHead(413, { "Content-Type": "text/plain" });
    return res.end("File size exceeds limit");
  }

  // Extract the boundary from the Content-Type header
  const boundary = getBoundary(req.headers["content-type"]);
  // Buffer to store the incoming data chunks
  const buffer = [];

  // Asynchronously read the data chunks from the request
  for await (const chunk of req) {
    buffer.push(chunk);
  }

  // Concatenate all chunks to form the complete data
  const data = Buffer.concat(buffer);
  // Split the data into parts based on the boundary
  const parts = splitMultipart(data, boundary);

  // Iterate over each part (file)
  for (const part of parts) {
    // Check if the part has a filename (indicating it's a file)
    if (part.filename) {
      // Validate Image Type
      const partFileType = await fileType.fromBuffer(part.data);
      if (!partFileType || !partFileType.mime.startsWith("image/")) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        return res.end("Invalid file type. Only image files are allowed.");
      }
      // Sanitize the filename to prevent directory traversal attacks
      const safeFilename = path.basename(part.filename);
      // Construct the full path to save the file
      const filePath = path.join(UPLOADS_DIR, safeFilename);
      // Write the file data to disk
      await writeFileAsync(filePath, part.data);

      // Respond to the client upon successful upload
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(`
        File uploaded successfully: ${safeFilename},
        Type: ${partFileType.mime}, 
        Size: ${bytesToKilobytes(part.data.length)} Kb`);
    }
  }
}

// Function to extract the boundary from the Content-Type header
function getBoundary(contentType) {
  // Split the header string to extract the boundary
  return contentType.split("; ")[1].split("=")[1];
}

// Function to split multipart data into parts using the boundary
function splitMultipart(buffer, boundary) {
  // Array to hold the parts
  const parts = [];
  // Create a buffer from the boundary string
  const boundaryBuffer = Buffer.from(`--${boundary}`);

  // Variables to keep track of positions in the buffer
  let lastIndex = 0;
  let start = buffer.indexOf(boundaryBuffer) + boundaryBuffer.length + 2;
  let end = buffer.indexOf(boundaryBuffer, start);

  // Iterate over the buffer to extract parts
  while (end > -1) {
    // Extract a part of the buffer
    const partBuffer = buffer.slice(start, end - 4); // -4 to remove the trailing '\r\n'
    // Parse the part to extract headers and data
    const part = parsePart(partBuffer);
    // Add the part to the parts array
    parts.push(part);

    // Update positions for the next iteration
    lastIndex = end + boundaryBuffer.length;
    start = lastIndex + 2;
    end = buffer.indexOf(boundaryBuffer, start);
  }

  // Return the array of parts
  return parts;
}

// Function to parse a part of the multipart data
function parsePart(buffer) {
  // Find the end of the headers section
  const headersEnd = buffer.indexOf("\r\n\r\n");
  // Extract the headers string
  const headersString = buffer.slice(0, headersEnd).toString();
  // Extract the data part, skipping the headers and two '\r\n'
  const data = buffer.slice(headersEnd + 4);
  // Parse the headers string into an object
  const headers = parseHeaders(headersString);

  // Return an object containing the parsed headers, data, and filename (if present)
  return {
    headers: headers,
    data: data,
    filename: headers["content-disposition"]
      ? headers["content-disposition"].filename
      : null,
  };
}

// Function to parse the headers string into an object
function parseHeaders(headersString) {
  // Object to hold the parsed headers
  const headers = {};
  // Split the string into lines
  const lines = headersString.split("\r\n");

  // Iterate over each line to parse headers
  lines.forEach((line) => {
    // Split each line into key and value
    const parts = line.split(": ");
    const header = parts[0].toLowerCase();
    const value = parts[1];

    // Check if the current header is 'Content-Disposition'
    if (header === "content-disposition") {
      // Initialize an empty object to store parsed key-value pairs
      const disposition = {};

      // Split the header value by '; ' to get individual properties
      value.split("; ").forEach((item) => {
        // Split each property into key and value
        const itemParts = item.split("=");
        if (itemParts.length === 2) {
          // Ensure that the property has both key and value
          const key = itemParts[0].trim(); // Remove whitespace from the key
          let val = itemParts[1].trim(); // Remove whitespace from the value

          // Remove any double quotes that might be wrapping the value
          val = val.replace(/"/g, "");

          // Add the parsed key-value pair to the 'disposition' object
          disposition[key] = val;
        }
      });

      // Add the 'disposition' object to the headers object with the key 'content-disposition'
      headers[header] = disposition;
    }
  });

  // Return the parsed headers object
  return headers;
}

function bytesToKilobytes(bytes) {
  return (bytes / 1024).toFixed(2); // Convert to KB and round to 2 decimal places
}
