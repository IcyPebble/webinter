from html_builder import HTMLBuilder
from server import Server
from PIL import Image
from io import BytesIO
import base64
import numpy as np
from scipy.io import wavfile
import asyncio

class Element:
    def __init__(self, webi, element_type, attr, html_tag, html_input_type):
        self.webi = webi
        self.type = element_type
        self.attr = attr
        self._html_builder_args = {
            "tag_name": html_tag, 
            "id": id(self),
            "type": html_input_type,
        }
        self.group = None
        self._value_response = asyncio.Event() # waits for a value response
        self.allowed_events = {
            "change": ["input-number", "input-text", "input-color", "input-file", "input-checkbox", "input-range", "input-select", "input-textarea"],
            "input": ["input-number", "input-text", "input-color", "input-file", "input-checkbox", "input-range", "input-select","input-textarea"],
            "click": ["input-button"]
        }
    
    def __call__(self, _async=True):
        return self.get(_async)

    # getter function
    def get(self, _async=True):
        async def async_():
            # Return None if the app hasn't been started yet
            if not self.webi.server.connected:
                return None
            
            # Call client
            await self.webi.server._emit("get_value", id(self))

            # Wait for client to return a value
            await self._value_response.wait()
            value = self._value_response.value

            # Reset the waiting variable
            self._value_response.clear()
            self._value_response.value = None

            return value
        
        if _async:
            return async_()
        return asyncio.run(async_())
    
    def add(self, position=0, anchor=None, _async=False):
        async def async_():
            # Create html and add to server
            html = HTMLBuilder.create_html_element(
                **self._html_builder_args, **self.attr
            )
            anchor_id = id(anchor) if anchor is not None else ""
            await self.webi.server._emit(
                "add_element", id(self), html,
                position, anchor_id
            )
            self.webi.elements[id(self)] = self
            
            return self
        
        if _async:
            return async_()
        return asyncio.run(async_())
    
    # decorator
    def on(self, event, _async=False):
        async def register(f):
            # Check if it is possible to register the event for the element
            if self.type not in self.allowed_events.get(event, []):
                raise ValueError(f"Element of type '{self.type}' has no event '{event}' ")
            
            # create empty dict for event if necessary
            if event not in self.webi.handlers:
                self.webi.handlers[event] = {}
            if id(self) not in self.webi.handlers[event]:
                self.webi.handlers[event][id(self)] = {}

            # register event (only the first time)
            if len(self.webi.handlers[event][id(self)]) == 0:
                await self.webi.server._emit("register_event", id(self), event)

            # set decorated function as handler
            self.webi.handlers[event][id(self)][id(f)] = f

            return f
        
        def register_sync(f):
            return asyncio.run(register(f))
        
        return register if _async else register_sync
    
    def remove_event_handler(self, event, handler, _async=True):
        async def async_():
            assert event in self.webi.handlers
            assert id(self) in self.webi.handlers[event]
            assert id(handler) in self.webi.handlers[event][id(self)]

            del self.webi.handlers[event][id(self)][id(handler)]

            if len(self.webi.handlers[event][id(self)]) == 0:
                await self.webi.server._emit("remove_event", id(self), event)
        
        if _async:
            return async_()
        asyncio.run(async_())
    
    def change_visibility(self, mode="toggle", _async=True):
        async def async_():
            await self.webi.server._emit("change_visibility", id(self), mode)
        
        if _async:
            return async_()
        asyncio.run(async_())
        
    def remove(self, _async=True):
        async def async_():
            self.webi.elements.pop(id(self), None) # remove from elements
            for item in self.webi.handlers.items(): # remove from all handlers
                item.pop(id(self), None)
            # remove (server side)
            await self.webi.server._emit("remove_element", id(self))
        
        if _async:
            return async_()
        asyncio.run(async_())
    
    def update_attr(self, attr, _async=True):
        async def async_():
            attr.pop("type", None) # Can not change the type (of an input)
            attr.pop("src", None) # Can not change the src (of a media element)
            attr.pop("style", None) # Should not change the style
            self.attr.update(attr)
            await self.webi.server._emit("update_attributes", id(self), attr)
        
        if _async:
            return async_()
        asyncio.run(async_())
    
    def remove_attr(self, attribute_names, _async=True):
        async def async_():
            for name in attribute_names:
                # Can not remove the type/src (of an input/media element), or style
                if name == "type" or name == "src" or name == "style":
                    continue
                self.attr.pop(name)
            await self.webi.server._emit("remove_attributes", id(self), attribute_names)
        
        if _async:
            return async_()
        asyncio.run(async_())

class MediaElement(Element):
    def __init__(self, webi, element_type, attr, html_tag, html_input_type, src, format):
        super().__init__(webi, element_type, attr, html_tag, html_input_type)
        self.src = src
        self.attr.pop("src", None)
        self.format = format
        self.allowed_events.update({
            "click": ["input-button", "image"],
            "play": ["audio", "video"],
            "pause": ["audio", "video"],
            "ended": ["audio", "video"]
        })
    
    def add(self, position=0, anchor=None, _async=False):
        async def async_():
            await super(self.__class__, self).add(position, anchor, _async=True)
            await self.change_src(self.src, self.format, _async=True)
            return self
        
        if _async:
            return async_()
        return asyncio.run(async_())
    
    def change_src(self, src, format, _async=True):
        self.src = src
        async def async_():
            if src is None: return
            file = {}
            if self.type == "image":
                if isinstance(self.src, (np.ndarray, Image.Image)):
                    if not isinstance(self.src, Image.Image):
                        # Create image from array (of type uint8)
                        img_src = Image.fromarray(self.src.astype(np.uint8))

                    # Save image object and read data
                    buffer = BytesIO()
                    img_src.save(buffer, format=format.upper())
                    buffer.seek(0)
                    file["src"] = buffer

                else:
                    file["src"] = self.src
            
            elif self.type == "audio":
                if isinstance(self.src, np.ndarray):
                    assert format.upper() == "WAV"

                    buffer = BytesIO()
                    wavfile.write(buffer, None, self.src)
                    buffer.seek(0)
                    file["src"] = buffer

                else:
                    file["src"] = self.src
            
            else:
                file["src"] = self.src
            
            file["mimetype"] = f"{self.type}/{format.lower()}"
            self.webi.server.file_storage[id(self)] = file
            await self.webi.server._emit(
                "change_src", id(self), file["mimetype"]
            )
        
        if _async:
            return async_()
        asyncio.run(async_())

class Group:
    def __init__(self, webi, sort):
        self.webi = webi
        self.sort = sort
        self.members = []
        self.group = None
    
    def _create(self, _async):
        async def async_():
            await self.webi.server._emit("create_group", id(self), self.sort)
            # Add group to webi
            self.webi.groups[id(self)] = self
        
        if _async:
            return async_()
        asyncio.run(async_())
    
    def toggle_sorting(self, sort, _async=True):
        async def async_():
            await self.webi.server._emit("toggle_sorting", id(self), sort)
            self.sort = sort
        
        if _async:
            return async_()
        asyncio.run(async_())

    def add_members(self, members, _async=True):
        async def async_():
            member_ids = []
            for member in members:
                # Only add elements without a group
                if member.group is not None:
                    raise ValueError(f"{member} is already part of a group")
                if member == self:
                    raise ValueError("Attempt to add the group as a member of the group itself")
                
                # Set elements group and add to members
                member.group = self
                self.members.append(member)
                member_ids.append(id(member))

            await self.webi.server._emit("add_to_group", id(self), member_ids)
        
        if _async:
            return async_()
        asyncio.run(async_())
    
    def remove_members(self, members, _async=True):
        async def async_():
            member_ids = []
            for member in members:
                # Only remove members that are in this group
                if member.group != self:
                    raise ValueError(f"{member} is not part of this group")
                
                # Set elements group to None and remove from members
                member.group = None
                self.members.remove(member)
                member_ids.append(id(member))

            await self.webi.server._emit("remove_from_group", id(self), member_ids)
        
        if _async:
            return async_()
        asyncio.run(async_())
    
    def disband(self, _async=True):
        async def async_():
            del self.webi.groups[id(self)]
            self.members = []
            await self.webi.server._emit("disband_group", id(self))
        
        if _async:
            return async_()
        asyncio.run(async_())
    
    def order(self, elements_in_order, _async=True):
        async def async_():
            ids = []
            for element in elements_in_order:
                # Can't order elements properly if in a different group
                if element.group != self:
                    raise ValueError(f"{element} is not part of this group")
                
                ids.append(id(element))
            
            # Order self.members accordingly
            ordered_members = []
            for m in self.members:
                if m not in elements_in_order:
                    ordered_members.append(m)
                if m == elements_in_order[0]:
                    ordered_members.extend(elements_in_order)
            self.members = ordered_members
            
            await self.webi.server._emit("order", ids)
        
        if _async:
            return async_()
        asyncio.run(async_())

class WebI:
    def __init__(self, port=8000):
        self.handlers = {}
        self.elements = {}
        self.groups = {}
        self.port = port
        self.server = Server(port=self.port, event_handler=self._event)

    # constructor
    def input(self, type, **attr):
        core = Element(
            webi = self,
            element_type = f"input-{type}",
            attr = attr,
            html_tag = "input",
            html_input_type = type
        )
        
        return core
    
    # constructor
    def image(self, src, format="PNG", **attr):
        core = MediaElement(
            webi = self,
            element_type = "image",
            attr = attr,
            html_tag = "img",
            html_input_type = None,
            src = src,
            format = format 
        )
        
        return core
    
    # constructor
    def audio(self, src, format="WAV", **attr):
        core = MediaElement(
            webi = self,
            element_type = "audio",
            attr = attr,
            html_tag = "audio",
            html_input_type = None,
            src = src,
            format = format
        )

        # Enable controls per default
        core.attr["controls"] = True
        
        return core
    
    def video(self, src, format="MP4", **attr):
        core = MediaElement(
            webi = self,
            element_type = "video",
            attr = attr,
            html_tag = "video",
            html_input_type = None,
            src = src,
            format = format
        )

        # Enable controls per default
        core.attr["controls"] = True

        return core

    # constructor
    def text(self, text, **attr):
        core = Element(
            webi = self,
            element_type = "text",
            attr = attr,
            html_tag = "p",
            html_input_type = None
        )

        core.attr["text"] = text
        
        return core
    
    def title(self, text, size = 1, **attr):
        assert 1 <= int(size) <= 6

        core = Element(
            webi = self,
            element_type = "title",
            attr = attr,
            html_tag = "h",
            html_input_type = None
        )

        core.attr["text"] = text
        core.attr["size"] = int(size)
        
        return core
    
    # arrangement
    def group(self, members, sort = True, _async=False):
        async def async_():
            group = Group(self, sort)
            await group._create(_async=True)
            await group.add_members(members, _async=True)
            return group
        
        if _async:
            return async_()
        return asyncio.run(async_())
    
    def alert(self, message, _async=True):
        async def async_():
            await self.server._emit("alert", message)

        if _async:
            return async_()
        asyncio.run(async_())

    def order(self, elements_in_order, _async=True):
        async def async_():
            ids = []
            for element in elements_in_order:
                # Can't order elements properly if in a group
                if element.group is not None:
                    raise ValueError(f"{element} is part of a group")
                
                ids.append(id(element))
            
            await self.server._emit("order", ids)
        
        if _async:
            return async_()
        asyncio.run(async_())
    
    # generic event handler
    async def _event(self, type, id, value):
        if type == "value_response": # user called element.get()
            # set elements value
            self.elements[id]._value_response.value = value
            self.elements[id]._value_response.set()
            return

        # call type specific handler(s) of element
        for handler in self.handlers[type][id].values():
            await handler(self.elements[id], value)
    
    def show(self):
        self.server.run()
    
    def shutdown(self, _async=True):
        async def async_():
            await self.server.shutdown()
        
        if _async:
            return async_()
        asyncio.run(async_())