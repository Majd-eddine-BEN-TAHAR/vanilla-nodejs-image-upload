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
const MAX_FILE_SIZE = 3 * 1024 * 1024; // Max file size set to 3MB
const MAX_TOTAL_REQUEST_SIZE = 20 * 1024 * 1024; // Max request size limit (20 MB)

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
      // Send a 500 Internal Server Error response in case of any unexpected errors
      sendResponse(
        res,
        500,
        "An error occurred while processing the request",
        false
      );
    }
  }
  // Respond with 405 Method Not Allowed for other HTTP methods
  else {
    sendResponse(res, 405, "Method Not Allowed");
  }
});

// Start listening on the defined port
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

async function handleFileUpload(req, res) {
  try {
    // Extract the boundary from the Content-Type header for multipart data
    let boundary;

    try {
      boundary = getBoundary(req.headers["content-type"]);
    } catch (error) {
      // Handle errors from getBoundary
      return sendResponse(
        res,
        400,
        `Error extracting boundary: ${error.message}`
      );
    }

    let parts;
    let totalSize = 0;
    try {
      // Initialize a buffer to store the incoming data chunks
      const buffer = [];
      // Read data chunks from the request and add them to the buffer
      for await (const chunk of req) {
        totalSize = totalSize + chunk.length;
        if (totalSize > MAX_TOTAL_REQUEST_SIZE) {
          return sendResponse(res, 413, "Total request size exceeds limit");
        }
        buffer.push(chunk);
      }

      const data = Buffer.concat(buffer); // Concatenate all chunks to form the complete file data
      parts = splitMultipart(data, boundary); // Split the data into parts based on the boundary
    } catch (error) {
      // Handle errors from splitMultipart
      return sendResponse(
        res,
        400,
        `Error splitting multipart data: ${error.message}`
      );
    }

    let uploadResults = []; // Array to store results of each file upload
    let allFilesValid = true; // Flag to track if all files are valid

    // First, validate all files
    for (const part of parts) {
      if (part.filename) {
        // Checking if the file size exceeded the limit
        if (part.data.length > MAX_FILE_SIZE) {
          allFilesValid = false;
          uploadResults.push({
            filename: part.filename,
            error: `File size exceeds ${bytesToKilobytes(
              MAX_FILE_SIZE
            )} Kb limit`,
          });
          continue;
        }
        const partFileType = await fileType.fromBuffer(part.data);
        if (!partFileType || !partFileType.mime.startsWith("image/")) {
          // If file is not an image, set flag to false and add error to results
          allFilesValid = false;
          uploadResults.push({
            filename: part.filename,
            error: "Invalid file type for upload",
          });
        } else {
          // Sanitize filename
          part.filename = sanitizeFilename(part.filename);

          // Generate a unique filename if there's a collision
          part.filename = await generateUniqueFilename(part.filename);

          // Add valid file info to results for later processing
          uploadResults.push({
            filename: part.filename,
            type: partFileType.mime,
            size: bytesToKilobytes(part.data.length) + " Kb",
            status: "File approved for upload",
          });
        }
      }
    }

    // If all files are valid, write them to disk
    if (allFilesValid) {
      for (const validFile of uploadResults) {
        const partIndex = parts.findIndex(
          (part) => part.filename === validFile.filename
        );
        const part = parts[partIndex];

        const safeFilename = path.basename(part.filename);
        const filePath = path.join(UPLOADS_DIR, safeFilename);
        await writeFileAsync(filePath, part.data);
        validFile.status = "Uploaded successfully";
      }
    }

    // Send a response with the upload results in JSON format
    sendResponse(res, 200, uploadResults);
  } catch (error) {
    // Send a 500 Internal Server Error response in case of any unexpected errors
    sendResponse(
      res,
      500,
      "An error occurred while processing the request",
      false
    );
  }
}

// Function to extract the boundary from the Content-Type header
function getBoundary(contentType) {
  // Robust check for null or undefined contentType
  if (!contentType) {
    throw new Error("Content-Type header is missing or undefined");
  }

  // Using a more explicit search for the boundary key
  const boundaryPrefix = "boundary=";
  const boundaryIndex = contentType.indexOf(boundaryPrefix);
  if (boundaryIndex === -1) {
    throw new Error("Boundary not found in Content-Type header");
  }

  // Extracting the boundary value
  return contentType.substring(boundaryIndex + boundaryPrefix.length);
}

// Function to split multipart data into parts using the boundary
function splitMultipart(buffer, boundary) {
  try {
    const parts = []; // Create an array to store the individual parts
    const boundaryBuffer = Buffer.from(`--${boundary}`); // Convert the boundary string into a Buffer

    let start = buffer.indexOf(boundaryBuffer) + boundaryBuffer.length + 2; // Find the starting position of the first boundary in the buffer
    let end = buffer.indexOf(boundaryBuffer, start); // Find the ending position of the first part

    // Checking if the boundary is not found in the buffer
    if (start === boundaryBuffer.length + 1) {
      throw new Error("Boundary not found in the buffer");
    }

    // Iterate through the buffer to extract parts
    while (end > -1) {
      // Adding check for overlapping boundaries or incorrect parsing
      if (start >= end) {
        throw new Error("Overlapping boundaries or incorrect multipart format");
      }

      // Extract the part content between start and end
      const partBuffer = buffer.slice(start, end - 2); // -2 to remove trailing '\r\n'

      const part = parsePart(partBuffer); // Parse the part content using a function named parsePart
      parts.push(part); // Add the parsed part to the parts array

      start = end + boundaryBuffer.length + 2; // Move to the start of the next part
      end = buffer.indexOf(boundaryBuffer, start); // Find the ending position of the next part
    }

    return parts;
  } catch (error) {
    // Handle errors by re-throwing them with an additional message
    throw new Error(`Error parsing multipart data: ${error.message}`);
  }
}

// Function to parse a part of the multipart data
function parsePart(buffer) {
  const headersEnd = buffer.indexOf("\r\n\r\n"); // Find the end of the headers section
  const headersString = buffer.slice(0, headersEnd).toString(); // Extract the headers string
  const data = buffer.slice(headersEnd + 4); // Extract the data part, skipping the headers and two '\r\n'
  const headers = parseHeaders(headersString); // Parse the headers string into an object

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
  const headers = {}; // Object to hold the parsed headers
  const lines = headersString.split("\r\n"); // Split the string into lines

  // Iterate over each line to parse headers
  lines.forEach((line) => {
    const parts = line.split(": "); // Split each line into key and value
    const header = parts[0].toLowerCase();
    const value = parts[1];

    // Check if the current header is 'Content-Disposition'
    if (header === "content-disposition") {
      const disposition = {}; // Initialize an empty object to store parsed key-value pairs

      // Split the header value by '; ' to get individual properties
      value.split("; ").forEach((item) => {
        const itemParts = item.split("="); // Split each property into key and value
        if (itemParts.length === 2) {
          // Ensure that the property has both key and value
          const key = itemParts[0].trim(); // Remove whitespace from the key
          let val = itemParts[1].trim(); // Remove whitespace from the value

          val = val.replace(/"/g, ""); // Remove any double quotes that might be wrapping the value
          disposition[key] = val; // Add the parsed key-value pair to the 'disposition' object
        }
      });

      // Add the 'disposition' object to the headers object with the key 'content-disposition'
      headers[header] = disposition;
    }
  });

  return headers; // Return the parsed headers object
}

function bytesToKilobytes(bytes) {
  return (bytes / 1024).toFixed(2); // Convert to KB and round to 2 decimal places
}

// Generate a unique filename to avoid collisions
async function generateUniqueFilename(originalFilename) {
  let counter = 0;
  let uniqueFilename = originalFilename;
  while (await existsAsync(path.join(UPLOADS_DIR, uniqueFilename))) {
    const filenameWithoutExt = path.basename(
      originalFilename,
      path.extname(originalFilename)
    );
    const fileExtension = path.extname(originalFilename);
    uniqueFilename = `${filenameWithoutExt}_${++counter}${fileExtension}`;
    uniqueFilename = sanitizeFilename(uniqueFilename);
  }
  return uniqueFilename;
}

// Sanitize filenames to prevent injection attacks and remove unwanted characters
function sanitizeFilename(filename) {
  // Remove path traversal characters like '../'
  filename = filename.replace(/\.\.\//g, "");

  // Replace non-alphanumeric, non-dot, and non-dash characters with an underscore
  filename = filename.replace(/[^a-z0-9.-]/gi, "_");

  // Convert to lowercase for consistency
  return filename.toLowerCase();
}

// Function to serve the HTML form for file upload
function serveForm(req, res) {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(`
        <form action="/" method="post" enctype="multipart/form-data">
            <input type="file" name="fileupload" multiple>
            <input type="submit" value="Upload">
        </form>
    `);
}

// Unified response function
function sendResponse(res, statusCode, data, isJson = true) {
  const contentType = isJson ? "application/json" : "text/plain";
  res.writeHead(statusCode, { "Content-Type": contentType });
  res.end(isJson ? JSON.stringify(data) : data);
}
