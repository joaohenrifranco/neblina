import { describe, expect, test } from "@jest/globals";
import { getFixedSizeChunk } from "@/infrastructure/utils/stream";

describe("chunkedStreamGenerator", () => {
	test("should yield chunks of the target size", async () => {
		const targetSize = 2;
		const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
		const reader = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(data);
				controller.close();
			},
		}).getReader();

		const chunks = [];
		for await (const chunk of getFixedSizeChunk(reader, targetSize)) {
			chunks.push(chunk);
		}

		expect(chunks).toEqual([
			new Uint8Array([1, 2]),
			new Uint8Array([3, 4]),
			new Uint8Array([5, 6]),
			new Uint8Array([7, 8]),
		]);
	});

	test("should yield the only chunk if it is smaller than the target size", async () => {
		const targetSize = 3;
		const data = new Uint8Array([1, 2]);
		const reader = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(data);
				controller.close();
			},
		}).getReader();

		const chunks = [];
		for await (const chunk of getFixedSizeChunk(reader, targetSize)) {
			chunks.push(chunk);
		}

		expect(chunks).toEqual([new Uint8Array([1, 2])]);
	});

	test("should yield smaller last chunk if the stream ends in the middle of a chunk", async () => {
		const targetSize = 3;
		const reader = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new Uint8Array([1, 2, 3]));
				controller.enqueue(new Uint8Array([4, 5, 6]));
				controller.enqueue(new Uint8Array([7, 8]));
				controller.close();
			},
		}).getReader();

		const chunks = [];
		for await (const chunk of getFixedSizeChunk(reader, targetSize)) {
			chunks.push(chunk);
		}

		expect(chunks).toEqual([
			new Uint8Array([1, 2, 3]),
			new Uint8Array([4, 5, 6]),
			new Uint8Array([7, 8]),
		]);
	});

	test("should yield nothing if the stream is empty", async () => {
		const reader = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.close();
			},
		}).getReader();

		const chunks = [];
		for await (const chunk of getFixedSizeChunk(reader, 1)) {
			chunks.push(chunk);
		}

		expect(chunks).toEqual([]);
	});

	test("blob from file should be equal to the original file", async () => {
		const targetSize = 27;
		const randomData = new Uint8Array(1234).map(() =>
			Math.floor(Math.random() * 256),
		);
		const reader = new ReadableStream<Uint8Array>({
			async start(controller) {
				for (let i = 0; i < randomData.length; i += targetSize) {
					controller.enqueue(randomData.subarray(i, i + targetSize));
					await new Promise((resolve) => setTimeout(resolve, 0));
				}
				controller.close();
			},
		}).getReader();

		let blob = new Blob();
		for await (const chunk of getFixedSizeChunk(reader, targetSize)) {
			blob = new Blob([blob, chunk]);
		}

		const blobBuffer = await blob.arrayBuffer();
		const originalBuffer = new Uint8Array(randomData).buffer;

		expect(blobBuffer).toEqual(originalBuffer);
	});
});
