import { SayHelloWorld } from "./dynamics";

(async () => {
  const result = await SayHelloWorld.run({ seed: 523452345235 });
  // console.log(JSON.stringify(result, null, 2), "\n");
})();
