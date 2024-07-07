import { build, emptyDir } from "@deno/dnt";

await emptyDir("./npm");

await build({
  entryPoints: ["./mod.ts"],
  outDir: "./npm",
  shims: {
    // see JS docs for overview and more options
    deno: true,
		undici: true,
  },
  package: {
    // package.json properties
    name: "planigale",
    version: Deno.args[0],
		description: "Minimalistic HTTP middleware framework inspired by express and fastify",
    license: "MIT",
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
