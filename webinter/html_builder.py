from airium import Airium

class HTMLBuilder:
    def _simple_input(id, **attr):
        a = Airium()

        with a.div():
            label = attr.pop("label", None)
            if label is not None: a.label(for_=id, _t=label)

            a.input(id=id, **attr)

        return str(a)
    
    def _button(id, **attr):
        a = Airium()

        with a.div():
            if "label" in attr:
                attr["value"] = attr["label"]
                del attr["label"]

            a.input(id=id, **attr)

        return str(a)
    
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
    
    def _textarea(id, **attr):
        del attr["type"]

        a = Airium()
        with a.div():
            label = attr.pop("label", None)
            if label is not None: a.label(for_=id, _t=label)

            a.textarea(id=id, **attr)

        return str(a)
    
    def _drawing_board(id, **attr):
        del attr["type"]

        a = Airium()
        with a.div():
            label = attr.pop("label", None)
            if label is not None: a.label(for_=id, _t=label)

            getattr(a, "drawing-board")(id=id, **attr)
        
        return str(a)

    def _img(id, **attr):
            a = Airium()
            with a.div():
                a.img(id=id, **attr)
            return str(a)
            
    def _audio(id, **attr):
            a = Airium()
            with a.div():
                a.audio(id=id, **attr)
            return str(a)

    def _video(id, **attr):
            a = Airium()
            with a.div():
                a.video(id=id, **attr)
            return str(a)

    def _p(id, **attr):
            a = Airium()
            text = attr.pop("text", "")

            with a.div():
                a.p(id=id, _t=text)
            return str(a)
            
    def _h(id, **attr):
            a = Airium()
            text = attr.pop("text", "")
            size = attr.pop("size", 1)

            with a.div():
                getattr(a, f"h{size}")(id=id, _t=text)
            return str(a)

    @classmethod
    def create_html_element(this, tag_name, id, **attr):
        if attr.get("type", 0) is None: attr.pop("type")
        attr.pop("style", None)
        tag_name = tag_name.replace("-", "_")

        if tag_name == "input":
            if attr["type"] in ["number", "text", "color", "file", "checkbox", "range"]:
                return this._simple_input(id, **attr)
                    
            elif attr["type"] in ["button", "select", "textarea"]:
                return this.__getattribute__(this, f"_{attr['type']}")(id, **attr)
                    
            else:
                raise ValueError(f"\'{attr['type']}\' is not a supported input type")
            
        else:
            try:
                return this.__getattribute__(
                    this, f"_{tag_name}"
                )(id, **attr)
            except AttributeError:
                raise NotImplementedError(f"tag_name = '{tag_name}'")