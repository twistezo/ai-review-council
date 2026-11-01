# Demo

`wizard.tape` using [VHS](https://github.com/charmbracelet/vhs) records a real review of `bug-farm` repository to GIF.

Note that it runs real `ai-review-council` app in background which uses subscription limits.

Run from the root:

```bash
brew install vhs
npm install

git init demo/bug-farm
git -C demo/bug-farm add .
git -C demo/bug-farm commit -m "Add review playground"

vhs demo/wizard.tape
```
