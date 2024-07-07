import denoConfig from "../deno.json" with { type: "json" };

switch(Deno.args[0]){
	case "major":
		denoConfig.version = `${parseInt(denoConfig.version.split(".")[0]) + 1}.0.0`;
		Deno.writeTextFileSync("./deno.json", JSON.stringify(denoConfig, null, 2));
		break;
	case "minor":
		denoConfig.version = `${parseInt(denoConfig.version.split(".")[0])}.${parseInt(denoConfig.version.split(".")[1]) + 1}.0`;
		Deno.writeTextFileSync("./deno.json", JSON.stringify(denoConfig, null, 2));
		break;
	case "patch":
		denoConfig.version = `${parseInt(denoConfig.version.split(".")[0])}.${parseInt(denoConfig.version.split(".")[1])}.${parseInt(denoConfig.version.split(".")[2]) + 1}`;
		Deno.writeTextFileSync("./deno.json", JSON.stringify(denoConfig, null, 2));
		break;
	default:
		console.log("Invalid argument. Use major, minor or patch");
		break;
}

