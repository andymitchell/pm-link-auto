import {sayHello} from "@pm-link-auto-test/unpublished-lib"

// Just expect this to not throw any errors, because it successfully imported ok.
if( sayHello()!=='hello' ) throw new Error("Failed import");
console.log("Ran OK");
