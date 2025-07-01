# Basic Test

Run `./consumer/test.sh`. 

It will link to the root pm-link-auto, then try to link to its unpublished-lib for the first time, then execute consume.js to prove it's linked.

# Changing Paths Test

After running the basic test, update the path in pm-link-auto.config.ts to point to `unpublished-lib-dupe` instead of `unpublished-lib` and run `npx pm-link-auto` again. It should ask you to correct the existing link. Then run `npx pm-link-auto` a 3rd time and it should confirm all ok (no changes).