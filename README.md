# Vanilla Node.js Image Upload

This Node.js project provides a simple HTTP server capable of handling file uploads.

## Features

- File upload functionality with multipart/form-data support.
- Image file type validation using the `file-type` library.
- Size limit enforcement for uploads (5MB maximum).
- Dynamic creation of an 'uploads' directory if it doesn't exist.

## Flow for File Upload from Browser to Server

### 1. Frontend: Form Submission and Data Preparation

#### 1. Form Submission:

A user interacts with a web form containing an `<input type="file">` element. Upon selecting a file and submitting the form (typically by clicking a submit button), the browser initiates the process of sending the file to the server.

#### 2. Preparation of FormData:

The browser automatically constructs a FormData object upon form submission. This FormData object contains the file selected by the user, along with any other data from the form (like text fields, checkboxes, etc.).

#### 3. Setting the Request Headers:

The browser sets necessary headers for the HTTP request:

- `Content-Type` is set to `multipart/form-data`, indicating the type of data being sent.
- A boundary string is generated and included in the `Content-Type` header. This string acts as a delimiter between different parts of the form data.

#### 4. Encoding Data:

The browser encodes the form data according to the `multipart/form-data` format:

- Each form field, including the file, is converted into a part of the request body.
- Each part is given its own `Content-Disposition` header, which includes the field name and, for files, the filename.
- The file part includes a `Content-Type` header indicating the file's MIME type.

#### 5. Creating the Request Body:

The complete FormData object is encoded into the request body. The boundary string is used to separate different parts of the form data within the request body.

#### 6. Sending the HTTP Request:

The browser sends the HTTP request to the server. This includes the encoded form data in the request body and the necessary headers.

### 2. Backend: Receiving and Processing the File

#### 1. Arrival of Request and Size Check:

The server receives the HTTP request and first checks the `Content-Length` header. If the file size exceeds the `MAX_FILE_SIZE` limit (e.g., 5MB), the server responds with a 413 error (Payload Too Large) and halts further processing.

#### 2. Data Reading:

The server reads data chunks from the request. Each chunk is added to a buffer array until all data chunks are received.

#### 3. Extracting Boundary:

The server calls `getBoundary` to extract the boundary string from the `Content-Type` header. This string is crucial for identifying different parts of the form data.

#### 4. Concatenating Data:

All data chunks are concatenated using `Buffer.concat` to form a single Buffer object, representing the entire payload.

#### 5. Splitting Multipart Data:

The `splitMultipart` function is invoked with the concatenated data and the boundary string:

- The function iterates over the buffer, using the boundary markers to find the start and end of each part.
- For each part, it slices the buffer to extract the part's data and calls `parsePart`.
- `parsePart`, in turn, calls `parseHeaders` to convert the headers string into an object.
- Each part, with its headers, data, and filename (if available), is added to an array of parts.

#### 6. Processing Each Part:

The server iterates over the array of parts:

- For file parts, it checks the MIME type using the `file-type` module.
- If the file is not an image (or another allowed type), a 400 error is sent back to the client.
- The filename is sanitized using `path.basename` to prevent directory traversal attacks.

#### 7. Writing File to Disk:

For each valid file, the server constructs a file path using `UPLOADS_DIR` and the sanitized filename. The file is written to the disk at the constructed path using `writeFileAsync`.

#### 8. Responding to the Client:

Upon successful file upload, the server sends a response to the client, including details like the file's name, MIME type, and size in kilobytes (converted using `bytesToKilobytes`).

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