import { access, copyFile, cp, mkdir } from "node:fs/promises";
await mkdir("dist/web", { recursive: true });
await Promise.all(
	["index.html", "styles.css"].map((file) =>
		copyFile(`src/web/${file}`, `dist/web/${file}`),
	),
);
try {
	await access("public/images");
	await cp("public/images", "dist/images", { recursive: true });
} catch (error) {
	if (error?.code !== "ENOENT") throw error;
}
console.log("Built local server and browser assets.");
