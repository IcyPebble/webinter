class DrawingBoard extends HTMLElement {
    static get observedAttributes() {
        return ["width", "height", "line_width", "color", "bg_color", "erase"];
    }

    constructor(default_width = 400, default_height = 300, default_line_width = 4, default_color = "black", default_bg_color = "white") {
        super();

        this.default_width = default_width;
        this.default_height = default_height;
        this.default_line_width = default_line_width;
        this.default_color = default_color;
        this.default_bg_color = default_bg_color;

        this.observe_attributes = false;
        this.namespace = "http://www.w3.org/2000/svg";
    }

    connectedCallback() {
        // Create shadow dom
        this.root = this.attachShadow({ mode: "open" });
        this.wrapper = document.createElement("div");
        this.wrapper.classList.add("drawing-board-wrapper");

        this.svg = document.createElementNS(this.namespace, "svg");
        this.wrapper.appendChild(this.svg);

        // Set attributes
        this.color = this.getAttribute("color") || this.default_color;
        this.bg_color = this.getAttribute("bg_color") || this.default_bg_color;
        this.background = document.createElementNS(this.namespace, "rect");
        this.background.setAttribute("width", "100%");
        this.background.setAttribute("height", "100%");
        this.background.setAttribute("fill", this.bg_color);
        this.erase = this.hasAttribute("erase");
        this.line_width = this.getAttribute("line_width") || this.default_line_width;
        this._adjust_size( // Also sets this.width and this.height
            this.getAttribute("width") || this.default_width,
            this.getAttribute("height") || this.default_height
        );
        this.clear();

        // Adjust svg size on resize
        this.resize_observer = new ResizeObserver(() => {
            this._adjust_size(
                this.width || this.default_width,
                this.height || this.default_height
            );
        });
        this.resize_observer.observe(this.wrapper);

        // Drawing functions
        this.is_drawing = false;
        this.current_line = undefined;
        this.svg.addEventListener("pointerdown", (e) => {
            this.is_drawing = true;
            let box = this.svg.getBoundingClientRect();
            let x = this.width * (e.offsetX / box.width);
            let y = this.height * (e.offsetY / box.height);

            this.current_line = document.createElementNS(this.namespace, "polyline");
            this.current_line.setAttribute("points", `${x},${y} `);
            this.current_line.setAttribute("stroke",
                (this.erase) ? this.bg_color : this.color
            );
            this.current_line.setAttribute("stroke-width", this.line_width);
            this.current_line.setAttribute("stroke-linecap", "round");
            this.current_line.setAttribute("fill", "none");

            this.svg.appendChild(this.current_line);
        });

        this.svg.addEventListener("pointermove", (e) => {
            if (this.is_drawing != false) {
                let box = this.svg.getBoundingClientRect();
                let x = this.width * (e.offsetX / box.width);
                let y = this.height * (e.offsetY / box.height);

                this.current_line.setAttribute("points", this.current_line.getAttribute("points") + `${x},${y} `);
            }
        });

        let on_draw_stop = (e) => {
            this.is_drawing = false;
            this.current_line = undefined;
        };
        this.svg.addEventListener("pointerup", on_draw_stop);
        this.svg.addEventListener("pointercancel", on_draw_stop);
        this.svg.addEventListener("pointerleave", on_draw_stop);

        // Add style
        this.style_sheet = new CSSStyleSheet();
        this.style_sheet.replaceSync(`
            .drawing-board-wrapper {
                touch-action: none;
                display: flex;
                align-items: center;
                justify-content: center;
                box-sizing: border-box;
                padding: 8px;
                width: 100%;
                height: 100%;
            }

            .drawing-board-wrapper>svg {
                cursor: crosshair;
                box-shadow: rgba(99, 99, 99, 0.2) 0px 2px 8px 0px;
            }
        `);
        this.style.display = "block";
        this.root.adoptedStyleSheets = [this.style_sheet];
        this.root.appendChild(this.wrapper);

        this.observe_attributes = true;
    }

    disconnectedCallback() {
        this.observe_attributes = false;
    }

    attributeChangedCallback(name, old_value, new_value) {
        if (!this.observe_attributes) { return; }
        switch (name) {
            case "width":
            case "height":
                this._adjust_size(
                    this.getAttribute("width") || this.default_width,
                    this.getAttribute("height") || this.default_height
                );
                break;

            case "line_width":
                this.line_width = new_value || this.default_line_width;
                break;

            case "color":
                this.color = new_value || this.default_color;
                break;

            case "bg_color":
                this.bg_color = new_value || this.default_bg_color;
                this.background.setAttribute("fill", this.bg_color);
                break;

            case "erase":
                this.erase = this.hasAttribute("erase");
                break;

            default:
                break;
        }
    }

    _adjust_size(w, h) {
        if (!(this.width == parseInt(w) && this.height == parseInt(h))) {
            this.width = parseInt(w);
            this.height = parseInt(h);

            this.svg.setAttribute("viewport", `0 0 ${this.width} ${this.height}`);
            this.svg.setAttribute("viewBox", `0 0 ${this.width} ${this.height}`);
            this.svg.setAttribute("width", this.width);
            this.svg.setAttribute("height", this.height);

            this.clear();
        }

        let cstyle = window.getComputedStyle(this.wrapper);
        let cw = this.wrapper.clientWidth - (parseFloat(cstyle.paddingLeft) + parseFloat(cstyle.paddingRight)) - (parseFloat(cstyle.borderLeftWidth) + parseFloat(cstyle.borderRightWidth));
        let ch = this.wrapper.clientHeight - (parseFloat(cstyle.paddingTop) + parseFloat(cstyle.paddingBottom)) - (parseFloat(cstyle.borderTopWidth) + parseFloat(cstyle.borderBottomWidth));
        this.scale = Math.min(
            cw / this.width,
            ch / this.height
        );
        this.svg.style.width = this.width * this.scale + "px";
        this.svg.style.height = this.height * this.scale + "px";
    }

    // Clears the "canvas" (svg)
    clear() {
        this.svg.replaceChildren();
        this.svg.appendChild(this.background);
    }

    // Removes the last stroke
    undo_last_stroke() {
        if (this.svg.children.length >= 2) {
            this.svg.removeChild(this.svg.lastElementChild);
        }
    }

    // Converts the svg into a png file object
    get_drawing(resolution = 1) {
        let xml = (new XMLSerializer()).serializeToString(this.svg);
        let svg_src = "data:image/svg+xml;base64," + btoa(xml);

        let img = new Image();
        return new Promise((resolve, reject) => {
            img.onload = () => {
                img.width = img.width * resolution;
                img.height = img.height * resolution;

                let canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;

                let ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, img.width, img.height);

                canvas.toBlob((blob) => {
                    if (blob) {
                        let file = new File([blob], "drawing.png", { type: "image/png" });
                        resolve(file);
                    } else {
                        reject();
                    }
                });
            };
            img.src = svg_src;
        });
    }
}

window.customElements.define("drawing-board", DrawingBoard);