//go:build js && wasm
// +build js,wasm

package main

import (
	"fmt"
	"io"
	"strings"
	"syscall/js"

	"github.com/rclone/rclone/backend/crypt"
	"github.com/rclone/rclone/fs/config"
	"github.com/rclone/rclone/fs/config/configmap"
	"github.com/rclone/rclone/fs/config/obscure"
)

var globalCipher *crypt.Cipher

type stringReadCloser struct {
	*strings.Reader
}

func (src stringReadCloser) Close() error {
	return nil
}

func createCipher(this js.Value, args []js.Value) interface{} {
	if len(args) < 2 {
		return map[string]interface{}{
			"success": false,
			"error":   "createCipher requires 2 arguments: password, salt",
		}
	}

	password := args[0].String()
	salt := args[1].String()
	obscuredPassword := obscure.MustObscure(password)

	configData := map[string]string{
		"password":            obscuredPassword,
		"filename_encryption": "standard",
		"filename_encoding":   "base32",
		"suffix":              ".bin",
	}

	if salt != "" {
		obscuredSalt := obscure.MustObscure(salt)
		configData["password2"] = obscuredSalt
	}

	configMap := configmap.Simple(configData)
	filenameEnc, _ := configMap.Get("filename_encryption")
	fmt.Printf("Creating cipher with config: filename_encryption=%s, password_set=%t, salt_set=%t\n",
		filenameEnc, password != "", salt != "")

	cipher, err := crypt.NewCipher(configMap)
	if err != nil {
		return map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to create cipher: %v", err),
		}
	}

	globalCipher = cipher
	return map[string]interface{}{
		"success": true,
	}
}

func encryptFilename(this js.Value, args []js.Value) interface{} {
	if globalCipher == nil {
		return map[string]interface{}{
			"error": "Cipher not initialized. Call createCipher first.",
		}
	}

	if len(args) < 1 {
		return map[string]interface{}{
			"error": "encryptFilename requires 1 argument: filename",
		}
	}

	filename := args[0].String()
	encrypted := globalCipher.EncryptFileName(filename)

	return map[string]interface{}{
		"result": encrypted,
	}
}

func decryptFilename(this js.Value, args []js.Value) interface{} {
	if globalCipher == nil {
		return map[string]interface{}{
			"error": "Cipher not initialized. Call createCipher first.",
		}
	}

	if len(args) < 1 {
		return map[string]interface{}{
			"error": "decryptFilename requires 1 argument: encryptedFilename",
		}
	}

	encryptedFilename := args[0].String()
	decrypted, err := globalCipher.DecryptFileName(encryptedFilename)
	if err != nil {
		return map[string]interface{}{
			"error": fmt.Sprintf("Failed to decrypt filename: %v", err),
		}
	}

	return map[string]interface{}{
		"result": decrypted,
	}
}


func obscurePassword(this js.Value, args []js.Value) interface{} {
	if len(args) < 1 {
		return map[string]interface{}{
			"error": "obscurePassword requires 1 argument: password",
		}
	}

	password := args[0].String()
	obscured := obscure.MustObscure(password)

	return map[string]interface{}{
		"result": obscured,
	}
}

func revealPassword(this js.Value, args []js.Value) interface{} {
	if len(args) < 1 {
		return map[string]interface{}{
			"error": "revealPassword requires 1 argument: obscuredPassword",
		}
	}

	obscuredPassword := args[0].String()
	revealed, err := obscure.Reveal(obscuredPassword)
	if err != nil {
		return map[string]interface{}{
			"error": fmt.Sprintf("Failed to reveal password: %v", err),
		}
	}

	return map[string]interface{}{
		"result": revealed,
	}
}

func encryptStream(this js.Value, args []js.Value) interface{} {
	if globalCipher == nil {
		return map[string]interface{}{
			"error": "Cipher not initialized. Call createCipher first.",
		}
	}

	if len(args) < 1 {
		return map[string]interface{}{
			"error": "encryptStream requires 1 argument: ReadableStream",
		}
	}

	stream := args[0]

	streamReader := &jsStreamReader{stream: stream}

	encryptedReader, err := globalCipher.EncryptData(streamReader)
	if err != nil {
		return map[string]interface{}{
			"error": fmt.Sprintf("Failed to encrypt stream: %v", err),
		}
	}

	return map[string]interface{}{
		"result": createJSReadableStream(encryptedReader),
	}
}

func decryptStream(this js.Value, args []js.Value) interface{} {
	if globalCipher == nil {
		return map[string]interface{}{
			"error": "Cipher not initialized. Call createCipher first.",
		}
	}

	if len(args) < 1 {
		return map[string]interface{}{
			"error": "decryptStream requires 1 argument: ReadableStream",
		}
	}

	stream := args[0]
	reader := stream.Call("getReader")
	var encryptedData []byte

	return map[string]interface{}{
		"result": createDecryptedStream(reader, &encryptedData),
	}
}

func createDecryptedStream(reader js.Value, encryptedData *[]byte) js.Value {
	return js.Global().Get("ReadableStream").New(map[string]interface{}{
		"start": js.FuncOf(func(this js.Value, args []js.Value) interface{} {
			controller := args[0]
			readAll := createReadAllFunc(reader, encryptedData, controller)
			readAll.Invoke()
			return nil
		}),
	})
}

func createReadAllFunc(reader js.Value, encryptedData *[]byte, controller js.Value) js.Func {
	var readAll js.Func
	readAll = js.FuncOf(func(this js.Value, args []js.Value) interface{} {
		promise := reader.Call("read")

		promise.Call("then", js.FuncOf(func(this js.Value, args []js.Value) interface{} {
			result := args[0]

			if result.Get("done").Bool() {
				processCompleteData(*encryptedData, controller, reader, readAll)
				return nil
			}

			value := result.Get("value")
			length := value.Get("length").Int()
			chunk := make([]byte, length)
			js.CopyBytesToGo(chunk, value)
			*encryptedData = append(*encryptedData, chunk...)

			readAll.Invoke()
			return nil
		})).Call("catch", js.FuncOf(func(this js.Value, args []js.Value) interface{} {
			controller.Call("error", args[0])
			reader.Call("releaseLock")
			readAll.Release()
			return nil
		}))

		return nil
	})
	return readAll
}

func processCompleteData(encryptedData []byte, controller, reader js.Value, readAll js.Func) {
	if len(encryptedData) == 0 {
		controller.Call("close")
		reader.Call("releaseLock")
		readAll.Release()
		return
	}

	encryptedReader := stringReadCloser{strings.NewReader(string(encryptedData))}
	decryptedReader, err := globalCipher.DecryptData(encryptedReader)
	if err != nil {
		controller.Call("error", js.ValueOf(err.Error()))
		reader.Call("releaseLock")
		readAll.Release()
		return
	}

	go streamDecryptedData(decryptedReader, controller, reader, readAll)
}

func streamDecryptedData(decryptedReader io.ReadCloser, controller, reader js.Value, readAll js.Func) {
	defer func() {
		decryptedReader.Close()
		reader.Call("releaseLock")
		readAll.Release()
	}()

	buffer := make([]byte, 65536)
	for {
		n, err := decryptedReader.Read(buffer)
		if n > 0 {
			chunk := js.Global().Get("Uint8Array").New(n)
			js.CopyBytesToJS(chunk, buffer[:n])
			controller.Call("enqueue", chunk)
		}
		if err == io.EOF {
			controller.Call("close")
			break
		}
		if err != nil {
			controller.Call("error", js.ValueOf(err.Error()))
			break
		}
	}
}

type jsStreamReader struct {
	stream     js.Value
	reader     js.Value
	buffer     []byte
	done       bool
	pendingRead bool
	readChan   chan readResult
}

type readResult struct {
	data []byte
	done bool
	err  error
}


func (r *jsStreamReader) Read(p []byte) (n int, err error) {
	if r.done {
		return 0, io.EOF
	}
	
	if r.reader.IsUndefined() {
		r.reader = r.stream.Call("getReader")
		r.readChan = make(chan readResult, 10)
		r.startReading()
	}
	
	if len(r.buffer) == 0 {
		select {
		case result := <-r.readChan:
			if result.err != nil {
				return 0, result.err
			}
			r.done = result.done
			if r.done {
				return 0, io.EOF
			}
			r.buffer = result.data
			if !r.pendingRead && !r.done {
				r.startReading()
			}
		default:
			if !r.pendingRead {
				r.startReading()
			}
			result := <-r.readChan
			if result.err != nil {
				return 0, result.err
			}
			r.done = result.done
			if r.done {
				return 0, io.EOF
			}
			r.buffer = result.data
		}
	}
	
	n = copy(p, r.buffer)
	r.buffer = r.buffer[n:]
	
	return n, nil
}

func (r *jsStreamReader) startReading() {
	if r.pendingRead {
		return
	}
	r.pendingRead = true

	promise := r.reader.Call("read")

	promise.Call("then", js.FuncOf(func(this js.Value, args []js.Value) interface{} {
		defer func() { r.pendingRead = false }()
		result := args[0]
		done := result.Get("done").Bool()

		if done {
			select {
			case r.readChan <- readResult{done: true}:
			default:
			}
		} else {
			value := result.Get("value")
			length := value.Get("length").Int()
			data := make([]byte, length)
			js.CopyBytesToGo(data, value)
			select {
			case r.readChan <- readResult{data: data, done: false}:
			default:
			}
		}
		return nil
	})).Call("catch", js.FuncOf(func(this js.Value, args []js.Value) interface{} {
		defer func() { r.pendingRead = false }()
		select {
		case r.readChan <- readResult{err: fmt.Errorf("stream read error")}:
		default:
		}
		return nil
	}))
}

func (r *jsStreamReader) Close() error {
	if !r.reader.IsUndefined() {
		r.reader.Call("releaseLock")
	}
	return nil
}

func createJSReadableStream(reader io.Reader) js.Value {
	return js.Global().Get("ReadableStream").New(map[string]interface{}{
		"start": js.FuncOf(func(this js.Value, args []js.Value) interface{} {
			controller := args[0]
			
			go func() {
				defer func() {
					if closer, ok := reader.(io.ReadCloser); ok {
						closer.Close()
					}
				}()
				buffer := make([]byte, 65536)
				
				for {
					n, err := reader.Read(buffer)
					if n > 0 {
						chunk := js.Global().Get("Uint8Array").New(n)
						js.CopyBytesToJS(chunk, buffer[:n])
						controller.Call("enqueue", chunk)
					}
					if err == io.EOF {
						controller.Call("close")
						break
					}
					if err != nil {
						controller.Call("error", js.ValueOf(err.Error()))
						break
					}
				}
			}()
			
			return nil
		}),
	})
}


func main() {
	config.ClearConfigPassword()

	js.Global().Set("createCipher", js.FuncOf(createCipher))
	js.Global().Set("encryptFilename", js.FuncOf(encryptFilename))
	js.Global().Set("decryptFilename", js.FuncOf(decryptFilename))
	js.Global().Set("encryptStream", js.FuncOf(encryptStream))
	js.Global().Set("decryptStream", js.FuncOf(decryptStream))
	js.Global().Set("obscurePassword", js.FuncOf(obscurePassword))
	js.Global().Set("revealPassword", js.FuncOf(revealPassword))

	fmt.Println("rclone WASM bridge loaded successfully")

	select {}
}
