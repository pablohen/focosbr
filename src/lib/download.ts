/** Saves text as a file from the browser (a temporary object URL). */
export function saveFile(text: string, type: string, name: string) {
	const url = URL.createObjectURL(new Blob([text], { type }));
	const a = document.createElement("a");
	a.href = url;
	a.download = name;
	a.click();
	URL.revokeObjectURL(url);
}
