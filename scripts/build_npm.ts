import { build, emptyDir } from "@deno/dnt";
import denoConfig from "../deno.json" with { type: "json" };

await emptyDir("./npm");

await build({
  entryPoints: ["./src/mod.ts"],
  outDir: "./npm",
  shims: {
    // see JS docs for overview and more options
    deno: true,
		undici: true,
		urlPattern: true,
  },
  package: {
    // package.json properties
    name: "planigale",
    version: denoConfig.version,
		description: "Minimalistic HTTP middleware framework inspired by express and fastify",
    license: "MIT",
		dependencies: {
			"@types/qs": "^6.9.15",
			qs: "^6.12.2",
			"@types/json-schema": "^7.0.15",
			ajv: "^8.16.0",
		},
		repository: {
			type: "git",
			url: "git+https://github.com/raaymax/planigale.git"
		},
		bugs: {
			url: "https://github.com/raaymax/planigale/issues"
		},
		homepage: "https://github.com/raaymax/planigale#readme",
  },
  postBuild() {
    // steps to run after building and before running the tests
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
    Deno.copyFileSync("README.md", "npm/README.md");
  },
});
