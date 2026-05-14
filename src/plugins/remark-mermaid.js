import { visit } from "unist-util-visit";

export function remarkMermaid() {
	return (tree) => {
		visit(tree, "code", (node) => {
			if (node.lang === "mermaid") {
				const code = node.value;
				node.type = "mermaid";
				node.data = {
					hName: "div",
					hProperties: {
						className: ["mermaid-container"],
						"data-mermaid-code": code,
					},
					hChildren: [{ type: "text", value: code }],
				};
				node.value = undefined;
			}
		});
	};
}
