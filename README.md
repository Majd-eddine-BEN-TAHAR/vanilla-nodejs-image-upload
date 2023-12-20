# Vanilla Node.js Image Upload

This Node.js project provides a simple HTTP server capable of handling file uploads.

## Features

- Single and multiple File upload functionality with multipart/form-data support.
- Image file type validation using the `file-type` library.
- Size limit enforcement for uploads (5MB maximum).
- Dynamic creation of an 'uploads' directory if it doesn't exist.
- Secure Filename Handling: 
   1. Filename sanitization to prevent directory traversal and injection attacks.
   2. Generation of unique filenames to avoid file name collisions.
- Detailed Upload Summary: Responds with detailed information about each file's upload status, including file name, MIME type, and file size in kilobytes.

## Flow for File Upload from Browser to Server

### 1. Frontend: Form Submission and Data Preparation

#### 1. Form Submission:

User interacts with a web form containing <input type="file">. Upon submission, the browser starts sending the file to the server.

#### 2. Preparation of FormData:

The browser constructs a FormData object containing the file and other form data.

#### 3. Setting the Request Headers:

The browser sets Content-Type to multipart/form-data with a boundary string.

#### 4. Encoding Data:

The form data is encoded, with each field including files becoming a part of the request body. Each part has a Content-Disposition header.

#### 5. Creating the Request Body:

The FormData object is encoded into the request body, using the boundary string to separate parts.

#### 6. Sending the HTTP Request:

The browser sends the HTTP request with the encoded form data and headers.


### 2. Backend: Receiving and Processing the File

#### 1. Arrival of Request and Size Check:

Your Node.js code begins execution when it receives the HTTP request. It checks the Content-Length header to ensure the file size doesn't exceed the MAX_FILE_SIZE limit.

#### 2. Data Reading:

Your Node.js code reads data chunks from the request and stores them in a buffer array until all data chunks are received.

#### 3. Extracting Boundary:

Your Node.js code calls the getBoundary function to extract the boundary string from the Content-Type header, which is essential for identifying different parts of the form data.

#### 4. Concatenating Data:

Your Node.js code concatenates all data chunks using Buffer.concat to form a single Buffer object representing the entire payload.

#### 5. Splitting Multipart Data:

Your Node.js code invokes the splitMultipart function to split the multipart data into parts using the boundary string. It iterates through the buffer, using boundary markers to find the start and end of each part, and calls parsePart for each part.

#### 6. Processing Each Part:

Your Node.js code processes each part, checking the MIME type using the file-type module for file parts. It sanitizes filenames to prevent directory traversal attacks and handles invalid files.

#### 7. Writing File to Disk:

For each valid file, your Node.js code constructs a file path and writes the file to disk at the specified path using writeFileAsync.

#### 8. Responding to the Client:

Upon successful file upload, your Node.js code sends a response to the client, including details like the file's name, MIME type, and size in kilobytes.

## Installation

You can install the required dependencies using npm:

```bash
npm install
```

## Running the Server

To start the server, run the following command:

```bash
    npm start
```


## Usage

1. Accessing the Server:
   Open your web browser and navigate to [http://localhost:3000](http://localhost:3000). You will be presented with a simple file upload form.

2. Uploading an Image:
   - Choose an image file using the file input.
   - Click the 'Upload' button.
   - The server will validate the file type and size before saving it to the 'uploads' directory.

3. Error Handling:
   - If the uploaded file exceeds the size limit or is not an image, the server will provide feedback.



## License

This project is licensed under MIT.