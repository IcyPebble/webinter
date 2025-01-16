const socket = io({
    reconnectionAttempts: 4
});

let app = document.getElementById("content");
let packers = {};
onmodification = () => Object.values(packers).forEach(packer => packer.fit());
window.onresize = onmodification;

function htmlToNode(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
}

function base64ToBlob(base64, typestr) {
    let raw = window.atob(base64);
    let rawLength = raw.length;
    let array = new Uint8Array(new ArrayBuffer(rawLength));

    for (let i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
    }

    let blob = new Blob([array], { type: typestr });

    return URL.createObjectURL(blob);
}

socket.on("add_element", (id, html, position, anchor_id) => {
    let node = htmlToNode(html);
    node.classList.add("element");
    node.id = id + "-container";

    if (anchor_id && (position === -1 || position === 1)) {
        anchor_element = document.getElementById(anchor_id);
        if (!anchor_element.classList.contains("group")) {
            anchor_element = anchor_element.parentElement;
        }
        if (position === -1) {
            app.insertBefore(node, anchor_element);
        }
        if (position === 1) {
            app.insertBefore(node, anchor_element.nextSibling);
        }
    } else {
        app.appendChild(node);
    }
});

socket.on("remove_element", (id) => {
    let element = document.getElementById(id);
    if (!element.classList.contains("group")) {
        element = element.parentElement;
    }
    element.remove();
    onmodification();
});

socket.on("register_event", (id, event) => {
    document.getElementById(id)[`on${event}`] = function (e) {
        let value;
        switch (event) {
            case "input":
            case "change":
                value = this.value;
                break;

            case "click":
                if (this.tagName == "IMG") { value = (e.offsetX, e.offsetY) }
                else { value = null }
                break;

            case "play":
            case "pause":
            case "ended":
                value = null;
                break;
        }

        socket.emit("element_event", event, id, value);
    };
});

socket.on("remove_event", (id, event) => {
    document.getElementById(id)[`on${event}`] = (e) => { };
})

function on_get_files(file_input) {
    let data = new FormData();
    data.append("id", file_input.id);

    for (let file of file_input.files) {
        data.append(file_input.id, file, file.name);
    }

    fetch("/file_upload", {
        method: "POST",
        body: data
    });
}

socket.on("get_value", (id) => {
    let element = document.getElementById(id);
    if (element.type == "file") {
        on_get_files(element);
    } else {
        socket.emit(
            "element_event", "value_response", id, element.value
        );
    }
})

socket.on("change_src", (id, typestr) => {
    let element = document.getElementById(id);
    fetch('/get_file?' + new URLSearchParams({ "id": id }).toString(), {
        method: "GET"
    }).then(res => res.blob()).then(data => {
        let blob = new Blob([data], { type: typestr });
        element.src = URL.createObjectURL(blob);
    });
})

socket.on("update_attributes", (id, attributes) => {
    let element = document.getElementById(id);

    for (let name in attributes) {
        switch (name) {
            case "text":
                element.innerText = attributes[name];
                break;

            case "label":
                if (element.type === "button") {
                    element.value = attributes["label"]
                } else {
                    let container = element.parentElement;
                    let label = container.getElementsByTagName("label")[0];
                    if (!label) {
                        label = document.createElement("label");
                        label.htmlFor = id;
                        container.insertBefore(label, container.firstChild);
                    }
                    label.innerText = attributes["label"];
                }
                break;

            case "options":
                let options = [];
                attributes["options"].forEach((o) => {
                    let option = document.createElement("option");
                    option.text = o[0];
                    option.value = o[1];
                    options.push(option);
                });
                element.replaceChildren(...options);
                break;

            case "selected":
                element.children.forEach((o, i) => {
                    if (attributes["selected"].includes(i)) {
                        o.selected = true;
                    } else {
                        o.selected = false;
                    }
                });
                break;

            default:
                element.setAttribute(name, attributes[name]);
        }
    }
    onmodification();
})

socket.on("remove_attributes", (id, names) => {
    let element = document.getElementById(id);
    names.forEach((name) => {
        switch (name) {
            case "text":
                element.innerText = "";
                break;

            case "label":
                if (element.type === "button") {
                    element.removeAttribute("value");
                } else {
                    let container = element.parentElement;
                    let label = container.getElementsByTagName("label")[0];
                    if (label) {
                        container.removeChild(label);
                    }
                }
                break;

            case "options":
                element.replaceChildren();
                break;

            case "selected":
                element.children.forEach((o) => {
                    o.selected = false;
                });
                break;

            default:
                element.removeAttribute(name);
        }
    });
    onmodification();
})

socket.on("change_visibility", (id, mode) => {
    let element = document.getElementById(id);
    switch (mode) {
        case "show":
            element.style.display = "";

        case "hide":
            element.style.display = "none";

        case "toggle":
            element.style.display = (element.style.display === "none") ? "" : "none";
    }
    onmodification();
});

socket.on("order", (ordered_ids) => {
    for (let i = 0; i < ordered_ids.length - 1; i++) {
        let first = document.getElementById(ordered_ids[i]);
        if (!first.classList.contains("group")) {
            first = first.parentElement;
        }
        let second = document.getElementById(ordered_ids[i + 1]);
        if (!second.classList.contains("group")) {
            second = second.parentElement;
        }

        let container = first.parentElement;
        container.insertBefore(second, first.nextSibling);
    }
    onmodification();
});

socket.on("create_group", (id, sort) => {
    let group = document.createElement("div");
    group.id = id;
    if (sort) { group.setAttribute("sort", "") };
    group.classList.add("group");
    app.appendChild(group);
    packers[id] = new Packer(group);
});

socket.on("toggle_sorting", (id, new_sort) => {
    let group = document.getElementById(id);
    if (new_sort) { group.setAttribute("sort", "") }
    else { group.removeAttribute("sort") }
    onmodification();
})

socket.on("add_to_group", (group_id, member_ids) => {
    let group = document.getElementById(group_id);
    member_ids.forEach((id) => {
        let element = document.getElementById(id);
        if (!element.classList.contains("group")) {
            element = element.parentElement;
        }
        element.remove()
        group.appendChild(element);
    });
    onmodification();
})

socket.on("remove_from_group", (group_id, member_ids) => {
    let group = document.getElementById(group_id);
    member_ids.reverse();
    member_ids.forEach((id) => {
        let element = document.getElementById(id);
        if (!element.classList.contains("group")) {
            element = element.parentElement;
        }
        group.parentElement.insertBefore(element, group.nextSibling);
    });
    onmodification();
});

socket.on("disband_group", (id) => {
    let group = document.getElementById(id);
    [...group.childNodes].forEach((child) => {
        group.parentElement.insertBefore(child, group.nextSibling);
    });
    group.remove();
    delete packers[id];
    onmodification();
});

socket.on("alert", (msg) => { alert(msg) });

socket.on("shutdown", () => {
    socket.disconnect();

    setTimeout(() => {
        alert("The server has been shut down so this page will be reloaded.");
        window.location.reload();
    }, 200);
})

window.onerror = (msg, url, line) => {
    socket.emit("error", msg);
};