const socket = io(window.location.href, {
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

socket.on("create_element", (id, html) => {
    let node = htmlToNode(html);
    node.classList.add("element", "unplaced");
    document.getElementById("unplaced-content").appendChild(node);
});

socket.on("add_element", (id, position, anchor_id) => {
    let node = document.getElementById(id + "-container");
    node.classList.remove("unplaced");

    onmodification();
    if (node.parentElement.id != "unplaced-content") {
        return;
    }

    node.remove();
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
        let value = null; // triggers element.get() if null
        let el = e.target;
        if (e.type == "click" && el.tagName == "IMG") {
            // Calculate the offset created by object-fit: contain
            contain_scaling = Math.min(
                el.width / el.naturalWidth, el.height / el.naturalHeight
            );
            contain_width = el.naturalWidth * contain_scaling;
            contain_height = el.naturalHeight * contain_scaling;
            contain_offset_x = Math.floor((el.width - contain_width) / 2);
            contain_offset_y = Math.floor((el.height - contain_height) / 2);

            let x = Math.floor((e.offsetX - contain_offset_x) / contain_scaling);
            let y = Math.floor((e.offsetY - contain_offset_y) / contain_scaling);
            // value = null if point lies outside of the image
            value = (
                (x >= 0 && x <= el.naturalWidth) &&
                (y >= 0 && y <= el.naturalHeight)
            ) ? [x, y] : null;
        }

        socket.emit("element_event", event, id, value);
    };
});

socket.on("remove_event", (id, event) => {
    document.getElementById(id)[`on${event}`] = (e) => { };
})

function on_get_files(id, files) {
    let data = new FormData();
    data.append("id", id);
    data.append("namespace", window.location.pathname);

    for (let file of files) {
        data.append(id, file, file.name);
    }

    fetch("/file_upload", {
        method: "POST",
        body: data
    });
}

function element_value(element) {
    let value = null;
    switch (element.type) {
        case "checkbox":
            value = element.checked;
            break;

        case "button":
            break;

        default:
            value = element.value || null;
            break;
    }

    return value;
}

socket.on("get_value", (id) => {
    let element = document.getElementById(id);
    if (element.type == "file") {
        on_get_files(id, element.files);
    } else {
        socket.emit(
            "element_event", "value_response", id, element_value(element)
        );
    }
})

socket.on("get_drawing_board", (id, res) => {
    let element = document.getElementById(id);
    element.get_drawing(res).then((file) => on_get_files(id, [file]));
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
                        label.id = id + "-label";
                        container.insertBefore(label, container.firstChild);
                    }
                    label.innerText = attributes["label"];
                }
                break;

            case "options":
                let options = [];
                attributes["options"].forEach((o) => {
                    let option = document.createElement("option");
                    option.id = id + "-option-" + o[0];
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

var custom_styles = {};
socket.on("update_style", (id, custom_style, rule) => {
    let element = document.getElementById(id);
    let custom = document.getElementById("custom-style");
    let sheet = custom.sheet;

    let css_rule = rule.replaceAll("<self>", `[id='${id}'].custom-style`);

    if (Object.keys(custom_style).length == 0 && css_rule in custom_styles) {
        let idx = custom_styles[css_rule]["idx"];
        delete custom_styles[css_rule];
        Object.keys(custom_styles).forEach((k) => {
            if (custom_styles[k]["idx"] > idx) {
                --custom_styles[k]["idx"];
            }
        });
        sheet.deleteRule(idx);
        for (v of Object.values(custom_styles)) {
            if (v["id"] == id) {
                return;
            }
        }
        element.classList.remove("custom-style");
        return;
    }
    if (!(css_rule in custom_styles)) {
        custom_styles[css_rule] = { "idx": Object.keys(custom_styles).length, "style": {}, "id": id };
        sheet.insertRule(css_rule + "{}", custom_styles[css_rule]["idx"]);
        element.classList.add("custom-style");
    }

    let removed = Object.keys(custom_styles[css_rule]["style"]).filter((k) => k in custom_style);
    custom_styles[css_rule]["style"] = custom_style;

    let style = sheet.cssRules[custom_styles[css_rule]["idx"]].style;
    Object.keys(custom_style).forEach((k) => {
        if (k in removed) {
            style[k] = "";
        } else {
            style[k] = custom_style[k];
        }
    });
})

socket.on("change_visibility", (id, mode) => {
    let element = document.getElementById(id + "-container");
    switch (mode) {
        case "show":
            element.style.display = "";
            break;

        case "hide":
            element.style.display = "none";
            break;

        case "toggle":
            element.style.display = (element.style.display === "none") ? "" : "none";
    }
    onmodification();
});

socket.on("clear_drawing_board", (id) => {
    let element = document.getElementById(id);
    element.clear();
});

socket.on("undo_drawing_board", (id) => {
    let element = document.getElementById(id);
    element.undo_last_stroke();
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

socket.on("download", (id, filename) => {
    fetch('/get_file?' + new URLSearchParams({ "id": id }).toString(), {
        method: "GET"
    }).then(res => res.blob()).then(data => {
        let blob = new Blob([data], { type: "application/octet-stream" });
        let url = URL.createObjectURL(blob);

        let a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.style.display = "none";

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
})

socket.on("open_url", (url, open_new_tab) => {
    let link = document.createElement("a");
    link.href = url;

    if (open_new_tab) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
    }

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
})

socket.on("shutdown", () => {
    socket.disconnect();

    setTimeout(() => {
        alert("The server has been shut down so this page will be reloaded.");
        window.location.reload();
    }, 200);
});

socket.on("disconnect_client", (msg) => {
    socket.disconnect();

    setTimeout(() => {
        info = document.createElement("div");
        info.style.width = "100vw";
        info.style.height = "100vh";
        info.style.display = "flex";
        info.style.justifyContent = "center";
        info.style.alignItems = "center";
        info.style.fontSize = "2em";

        info.innerText = msg;
        document.body.replaceChildren(info);
    }, 200);
})

window.onerror = (msg, url, line) => {
    socket.emit("error", msg);
};