# Vanilla Node.js Image Upload

This Node.js project provides a simple HTTP server capable of handling file uploads.

## Features

- File upload functionality with multipart/form-data support.
- Image file type validation using the `file-type` library.
- Size limit enforcement for uploads (5MB maximum).
- Dynamic creation of an 'uploads' directory if it doesn't exist.

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