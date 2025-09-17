export async function* getFixedSizeChunk(
	reader: ReadableStreamDefaultReader<Uint8Array>,
	targetSize: number,
): AsyncGenerator<Uint8Array, void, unknown> {
	let buffer = new Uint8Array(targetSize);
	let bufferOffset = 0;

	while (true) {
		const { done, value: chunck } = await reader.read();

		if (done) {
			if (bufferOffset > 0) {
				yield buffer.subarray(0, bufferOffset);
			}
			return;
		}

		let chunkOffset = 0;
		while (chunkOffset < chunck.byteLength) {
			const spaceLeft = buffer.byteLength - bufferOffset;
			const bytesToCopy = Math.min(spaceLeft, chunck.byteLength - chunkOffset);

			buffer.set(
				chunck.subarray(chunkOffset, chunkOffset + bytesToCopy),
				bufferOffset,
			);
			bufferOffset += bytesToCopy;
			chunkOffset += bytesToCopy;

			if (bufferOffset === targetSize) {
				yield buffer;
				buffer = new Uint8Array(targetSize);
				bufferOffset = 0;
			}
		}
	}
}
