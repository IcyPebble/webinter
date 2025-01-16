from webinter import WebI

webi = WebI()

webi.title("Image selector demo", size=1).add()
txt = webi.text("Select an image and press 'Show'!").add()
file_input = webi.input("file", label="Select a file:", accept="image/*", multiple=True).add()
btn = webi.input("button", label="Show").add()
img = webi.image(None).add(position=-1, anchor=file_input)
close_btn = webi.input("button", label="Close").add()

@btn.on("click")
async def show(element, _):
    files = await file_input()
    if len(files) > 0:
        await txt.update_attr({"text": f"Showing: {files[0]["base"]}"})
        await img.change_src(files[0]["file"], files[0]["extension"])
    else:
        await webi.alert("No image selected!")

@close_btn.on("click")
async def close(*_):
    await webi.shutdown()

webi.show()