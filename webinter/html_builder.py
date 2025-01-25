from airium import Airium

class HTMLBuilder:
    @staticmethod
    def _simple_input(id, **attr):
        a = Airium()

        with a.div():
            label = attr.pop("label", None)
            if label is not None: a.label(for_=id, _t=label)

            a.input(id=id, **attr)

        return str(a)
    
    @staticmethod
    def _button(id, **attr):
        a = Airium()

        with a.div():
            if "label" in attr:
                attr["value"] = attr["label"]
                del attr["label"]

            a.input(id=id, **attr)

        return str(a)
    
    @staticmethod
    def _select(id, **attr):
        del attr["type"]

        a = Airium()
        with a.div():
            options = attr.pop("options")
            selected = attr.pop("selected", [])
            label = attr.pop("label", None)

            if label is not None: a.label(for_=id, _t=label)

            with a.select(id=id, **attr):
                for i, option in enumerate(options):
                    option_attr = {"value": option[1], "_t": option[0]}
                    if i in selected:
                        option_attr["selected"] = True
                    a.option(**option_attr)

        return str(a)
    
    @staticmethod
    def _textarea(id, **attr):
        del attr["type"]

        a = Airium()
        with a.div():
            label = attr.pop("label", None)
            if label is not None: a.label(for_=id, _t=label)

            a.textarea(id=id, **attr)

        return str(a)
    
    @staticmethod
    def _drawing_board(id, **attr):
        del attr["type"]

        a = Airium()
        with a.div():
            label = attr.pop("label", None)
            if label is not None: a.label(for_=id, _t=label)

            getattr(a, "drawing-board")(id=id, **attr)
        
        return str(a)

    @classmethod
    def create_html_element(this, tag_name, id, **attr):
        if attr.get("type", 0) is None: attr.pop("type")
        attr.pop("style", None)
        match tag_name:
            case "input":
                match attr["type"]:
                    case "number" | "text" | "color" | "file" | "checkbox" | "range":
                        return this._simple_input(id, **attr)
                    
                    case "button" | "select" | "textarea":
                        return this.__getattribute__(this, f"_{attr['type']}")(id, **attr)
                    
                    case _:
                        raise ValueError(f"\'{attr['type']}\' is not a supported input type")
            
            case "drawing-board":
                return this._drawing_board(id, **attr)

            case "img":
                a = Airium()
                with a.div():
                    a.img(id=id, **attr)
                return str(a)
            
            case "audio":
                a = Airium()
                with a.div():
                    a.audio(id=id, **attr)
                return str(a)

            case "video":
                a = Airium()
                with a.div():
                    a.video(id=id, **attr)
                return str(a)

            case "p":
                a = Airium()
                text = attr.pop("text", "")

                with a.div():
                    a.p(id=id, _t=text)
                return str(a)
            
            case "h":
                a = Airium()
                text = attr.pop("text", "")
                size = attr.pop("size", 1)

                with a.div():
                    getattr(a, f"h{size}")(id=id, _t=text)
                return str(a)

            case _:
                raise NotImplementedError(f"tag_name = '{tag_name}'")