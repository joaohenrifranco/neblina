import { computed, type Ref, ref, watch } from "vue";

const createHiddenInput = (
	parentNode: HTMLElement,
	handleInputChange: () => void,
) => {
	if (!parentNode.appendChild) {
		throw new Error("Parent node is not an appendable HTMLElement");
	}

	const input = document.createElement("input");
	input.type = "file";
	input.multiple = true;
	input.style.display = "none";
	input.addEventListener("change", handleInputChange);
	parentNode.appendChild(input);
	return input;
};

export function useFileInput(
	parentRef: Ref<HTMLElement | null>,
	onFilesSelected?: (files: FileList) => void,
) {
	const hiddenInput = ref<HTMLInputElement | null>(null);

	const handleInputChange = () => {
		console.log("FileInput: Change event triggered");
		const files = hiddenInput.value?.files;
		console.log("FileInput: Files selected:", files);
		if (files && files.length > 0 && onFilesSelected) {
			console.log("FileInput: Calling onFilesSelected callback");
			onFilesSelected(files);
		}
	};

	watch(parentRef, (newParent) => {
		if (newParent) {
			hiddenInput.value = createHiddenInput(newParent, handleInputChange);
		}
	});

	const files = computed(() => hiddenInput.value?.files || null);

	return {
		handleClick: () => hiddenInput.value?.click(),
		files,
	};
}
