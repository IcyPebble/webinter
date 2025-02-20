# Webinter
The aim of “WebInter” is to provide (existing) Python code with simple and good-looking *web* *inter*faces. In this sense, it is not intended to enable the creation of finished apps or games, but merely to make code more interactive and illustrate results based on user input.

<span style="color:grey; font-size: x-small"><i>This is just a “small” project and thus will be maintained/updated irregularly</i></span>

### Table of contents
1. [Installation](#installation)
2. [A basic application](#a-basic-application)
3. [The core of every application](#the-core-of-every-application)
4. [Sync or async?](#sync-or-async)
5. [How to use elements](#how-to-use-elements)
6. [Handling events](#handling-events)
7. [Modifing the arrangement](#modifing-the-arrangement)
8. [Additional functions](#additional-functions)
9. [API](#api)

# Installation
Currently, in order to use WebInter, you have to copy the folder “webinter” into the same folder where your project file is located.

## A basic application
A simple webinter program may look like this:
```python
1  from webinter import WebI
2 
3  webi = WebI()
4 
5  count = webi.input("number", label="How many apples?")
6  count.add()
7  send = webi.input("button", label="Request").add()
8 
9  @send.on("click")
10 async def request(element, value):
11     print(f"{await count()} apple(s) please")
12
13 webi.show()
```
The program above will activate a web server running on http://127.0.0.1:8000. In the browser you will then see the created application. To explain the steps:
1. Line 1: Import the core of the application, the [WebI](#the-core-of-every-application) class
2. Line 3: Create a WebI instance
3. Line 5-7: Add two input [elements](#how-to-use-elements), one for a number and one button, each with a label
4. Line 9-11: Link the "click" [event](#handling-events) of the button with an [asynchronous](#sync-or-async) handler function
5. Line 13: Finally, start the application

## The core of every application
The first thing you need to do after importing the module is to create an instance of the WebI class, like this:
```python
from webinter import WebI

webi = WebI()
```

After that you can start creating your application.
And finally, all you have to do is start the underlying server:
```python
webi.show()
```
 > &#9432; Everything written after this line is no longer executed

The application now runs at [http://127.0.0.1:{port}](http://127.0.0.1:8000), with the port being 8000 by default or the port you specified when creating the WebI instance (e.g.: ```WebI(port=8000)```). You can access the port via the .port attribute<br>
You can close the application by pressing CTRL+C in the terminal or by directly calling ```webi.shutdown()```.

## Sync or async?
Due to the use of Quart as a web framework, Webinter is asynchronous by nature. This is also the reason why the event handlers must be declared as asynchronous.<br>
Almost all other functions can also be used asynchronously, but do not have to be: the ```_async``` parameter can be used to determine whether the function is executed synchronously or acts as an awaitable async function.<br>With ```_async = None```, the function is executed either asynchronously or synchronously, depending on the context. ```_async``` is set to None by default.

Therefore, webinter functions can also be called within the event handlers:
```python
btn = webi.input(type="button")
btn.add() # sync

@btn.on("click") # sync
async def onclick(el, v): # async
    txt = webi.text("Clicked!")
    await txt.add() # async
    # -> eq. to: await txt.add(_async=True)
```

As you can see with ```btn.add()``` and ```txt.add()```, you do not always have to specify the _async parameter. However, you should not forget to await the functions if they are called in an asynchronous context. If it is necessary to decide for yourself whether the function is asynchronous or not, a list of all functions that accept the _async parameter can be found below:
<details>
<summary>Functions with the _async parameter</summary>

- WebI.group                   
- WebI.order                   
- WebI.alert                   
- WebI.download                
- WebI.shutdown                
- Element.get                  
- Element.add                  
- Element.remove               
- Element.on                   
- Element.remove_event_handler 
- Element.change_visibility    
- Element.update_attr          
- Element.remove_attr          
- MediaElement.change_src      
- DrawingBoard.toggle_eraser   
- DrawingBoard.clear           
- DrawingBoard.undo            
- Group.add_members            
- Group.remove_members         
- Group.disband                
- Group.order                  
- Group.toggle_sorting         
</details>

## How to use elements
After creating the core of our application (```webi = WebI()```), we can start adding content.
There are multiple types of elements: [inputs](#inputs), [text](#text), [images, audio and videos](#images-audio-and-video)

However, these are not yet displayed after creation. To do this, the ```add()``` function must first be called. It returns the element itself, so it can be called in the same line. In order to remove the element again afterwards, ```remove()``` may be called.
Each element can be found as an entry ({id(element): element}) in the ```webi.elements``` dictionary

Yet, this function deletes the element and its event handlers completely; the ```change_visibility(mode="toggle"|"show"|"hide")``` function is therefore often better suited for simple hiding/display.<br>

If you want to change or remove certain attributes of an element you can use ```update_attr()``` and ```remove_attr()``` repectively, with a dictionary of attributes or a list of attribute names as their first argument. "type", "src" and "style" can't be changed or removed.<br>

At last, the current value of an input element can be accessed by either calling them directly or calling the ```get()``` function.

The individual element types and their special attributes are explained in more detail in the following sections. However, it should be noted that all attributes that are considered Boolean attributes in the HTML declaration must only be present, whereby the value is irrelevant (therefore ```remove_attr(attr)``` should be used here instead of ```update_attr(attr=False)```).

#### Attributes
| name | value | notes |
|---|---|---|
| webi | WebI | The WebI instance it was created from |
| type | string | The type of the element. Often corresponds to the name of the function with which it was created |
| group | Group | The group to which this element belongs. See [Groups](#groups) |
| attr | dict | A collection of all attributes that are set for this element. Changes to this dictionary have no effect, use update_attr() or remove_attr() instead |

### Inputs
An input element can be created in the following way:
```python
input_element = webi.input(type: str, **attr)
```
The **type** argument is similar to the HTML declaration, therefore<br>**"number", "text", "color", "file", "checkbox", "range", "button", "select" and "textarea"**<br>are permitted so far. In fact, theres is another (custom) type **"draw"**, which creates a [drawing board](#drawing-boards).

All other **attributes** apply and behave in the same way **as those of the respective HTML element**. See [here](https://developer.mozilla.org/en-US/docs/Web/HTML/Element#forms) for more information. However, there are also exceptions, which are listed in the following table:

| type | attribute | comment |
|------|-----------|---------|
| all except button | label | creates a label tag with the given value as its name | 
| button | value / label | can be used interchangeable |
| select | options | a list of (name, value) option pairs |
| select | selected | a list of indicies corresponding to the options. Multiple indicies require the "multiple" attribute to be present |

To get the current value of the input element you can call it directly or its ```get()``` method.<br>
Inputs with type=file will return a list containing each selected file as a dictionary as follows:
```
{
   "file": BytesIO buffer,
   "name": Full filename,
   "base": Name of the file without the extension,
   "extension": Extension of the filename ("jpg", "mp4", etc.),
   "type": MIME type ("image", "video", etc.),
   "format": MIME subtype ("png", "javascript", etc.)
}
```

### Drawing boards
Drawing boards are a special type of input element:
```python
drawing_board = webi.input("draw", **attr[
   width: int = 400,
   height: int = 300,
   line_width: int = 4,
   color: str = "black",
   bg_color: str = "white",
   erase
])
```
**width** and **height** specify the dimension of the image (in pixels, as does **line_width**).<br>
The color of the line or the background can be configured with a valid CSS color value for **color** and **bg_color**.<br>
The **erase** attribute acts like a Boolean HTML attribute.

To empty the board, you can call its ```clear()``` method. Or you can undo your last stroke with ```undo()```. However, this does not undo changes made to the attributes.<br>
To easily switch the eraser on and off, ```toggle_eraser(erase: (bool | NoneType) = None)``` may be used instead of remove_attr and update_attr (*erase = None* will inverse the current setting).

The ```get(res: (float | int) = 1)``` method returns the drawn image (width\*res x height\*res):
```
[{
   "file": BytesIO buffer,
   "name": "drawing.png",
   "base": "drawing",
   "extension": "png",
   "type": "image",
   "format": "png"
}]
```

### Text
A text element can be created in the following way:
```python
text_element = webi.text(text: str, **attr)
```
Internally, the text element is implemented as an [HTML Paragraph element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/p). 
This means that all of its permitted **attributes** also apply.

#### Titles
Titles (or headings) are a special form of text that are created as follows:
```python
title = webi.title(text: str, size: int = 1, **attr)
```
The title **size** is a number between 1 and 6, with 1 as the largest size.<br>
A title is implemented as an [HTML Heading element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/Heading_Elements).

### Images, audio and video
Images, audio and videos can be created as follows:
```python
image_element = webi.image(src: (str | BytesIO | ndarray | None), format: str = "PNG", **attr)

audio_element = webi.audio(src: (str | BytesIO | ndarray | None), format: str = "WAV", **attr)

video_element = webi.video(src: (str | BytesIO | None), format: str = "MP4", **attr)
```
The **source** must be a valid file path or a BytesIO buffer, whereby a numpy array is also valid for images and audio. You may pass None to set no source.
The **format** must also correspond to the file format of the specified file. However, the format of an audio specified as a numpy array must be “WAV” (wave file).

The “control” attribute is present by default for audio and video elements. To disable these, ```remove_attributes(["controls"])``` should be called. Note that an audio element is not visible without the control attribute.

To change the source of the element, you may call ```change_src(new_source, file_format_of_new_source)```.

All other **attributes** apply and behave in the same way **as those of the respective HTML element**.

## Handling events
To handle events that are triggered on an element, you can use the function ```on```:<br>
```python
element.on(event: str, _async) -> Callable[[f: Awaitable], f] | Awaitable[[f: Awaitable], f]
```

The **event** parameter defines the type of event to be listened to. Not all events are supported, and they are only supported for certain types of elements. See [here](https://developer.mozilla.org/en-US/docs/Web/Events) for a reference.

The ```on``` function is designed as an decorator:
```python
@element.on(event)
async def handler(element, value):
   # ...

# Same as:
element.on(event)(handler)
```

You can chain them to register the same function for multiple elements/events at once:
```python
@element1.on(event1)
@element1.on(event2)
@element2.on(event)
async def handler(element, value):
   # ...
```

It is also possible to use this function in an asynchronous context:
```python
async def func():
   @element.on(event)
   async def handler(element, value):
      # ...
```
<br>

The “handler” function, as in the examples above, **must** always be async and take two arguments.<br>
The first argument is the element on which the event was triggered.<br>
The (new) value of the element or None ( = the same value that element.get() returns) is given to the function as the second argument. For the “click” event of images, a coordinate is returned [x (left), y (top)].

To remove a handler function, the ```remove_event_handler``` function can be called:
```python
element.remove_event_handler(event, handler)
```

All registered handlers are stored in the ```webi.handlers``` dictionary as follows:
```handlers[event_type][id(element)][id(handler_function)] = handler_function```

## Modifing the arrangement
A WebInter application is normally structured like an article, all elements are placed one below the other. The order in which they are added also determines the order on the web page.<br>
However, the order can be changed when adding elements or afterwards: by [groups](#groups), by the [order function](#order) or by arguments of the [add function](#add).

### Groups
Groups combine several elements into a single one. A group can be created as follows:
```python
webi.group(members: Iterable[Element | Group], sort: bool = True)
```
Groups do not have an add method; they are created directly with the initial **members** and added to the application at the last position. 

Elements within a group are placed to fill as much space as possible. For this purpose, they are sorted by default in descending order according to their width. This can be prevented with the **sort** argument set to False if necessary. It is also possible to change this after creation with ```toggle_sorting(sort: bool)```. Whether a group is sorted is reflected in the **.sort** property.
> &#9432; .order() will have no visual effect as long as sort is True.

To append further members to the group after creation, the ```add_members(members: Iterable[Element | Group])``` function can be used. With ```remove_members(members: Iterable[Element | Group])```, given members are removed from the group and placed in the parent container element behind the group. You can access a list of all current members via the **.members** property.

Each group, just like each element, also has the **.group** and the **.webi** property.
You can access every group as an entry ({id(group): group}) of the ```webi.group``` dictionary.

If the group is dissolved using the ```disband()``` function, the group is deleted and all members are moved to the former position of the group in their order.

### .order()
Both the WebI instance and groups have the order function to change the order of their child elements.
```python
container.order(elements_in_order: Iterable[Element | Group])
```
All elements in **elements_in_order** are moved in their order after the position of the first element of elements_in_order. Not all elements of the container have to be present in this list.

An example of how it works:

```
container[A, {B}, C, {D}, E, {F}]
container.order([B, D, F])

=>

container[A, {B, D, F}, C, E]
```

### .add()
The add function of elements adds the element to the end of the arrangement by default. However, it is possible to influence this by calling it with two additional arguments:
```python
element.add(position: int, anchor: (Element | Group))
```
The position can be either -1 or 1.<br>
A position of -1 places the element **before** the anchor element,<br>
while a position of 1 places the element **after** the anchor element.<br>


## Additional functions
You can display a pop-up with ```webi.alert(msg: str)```.

---
A download window can be opened in the following way:
```python
webi.download(buffer: IOBuffer, filename: str)
```
Here, **buffer** contains the (binary) file data and **filename** defines the name of the file including its extension.

## API
### WebI
```python
WebI(port: int = 8000)
```

<details>
<summary>Parameters</summary>

 > **port** (int): The port of the server (i.e. 127.0.0.1:{port}).<br>
 By default 8000
</details>

<details>
<summary>Attributes</summary>

 > **handlers** (dict): A collection of all event handlers.<br>
  handlers[event_type][element_id][handler_id] = handler

 > **elements** (dict): A collection of all added elements.<br>
 elements[element_id] = element

 > **groups** (dict): A collection of all groups.<br>
 groups[group_id] = group

 > **server** (Server): The underlying server instance
</details>

<details>
<summary>Methods</summary>

 > **input(type, \**attr)**:<br>
  **image(src, format, \**attr)**:<br>
  **audio(src, format, \**attr)**:<br>
  **video(src, format, \**attr)**:<br>
  **text(text, \**attr)**:<br>
  **title(text, size, \**attr)**:<br>
    Returns an ```Element``` with the corresponding type and attributes.<br>
    See [Elements](#how-to-use-elements) for more information.

 > **group(members, sort, _async)**:<br>
    Returns a ```Group```.<br>
    See [Group](#group) for more information

 > **alert(message, _async)**: Displays a message pop-up.

 > **order(elements_in_order, _async)**: Arranges the elements as given. Not all elements have to be provided.

 > **show()**: Starts the server/application.

 > **shutdown()**: Closes the application.
</details>

### Element
```python
Element(webi: WebI, element_type: str, attr: dict, html_tag: str, html_input_type: (str | None))
```
<details>
<summary>Parameters</summary>

 > **webi** (WebI): A WebI instance

 > **element_type** (str): The type/name of the element

 > **attr** (dict): A collection of attributes

 > **html_tag** (str): The html tag name for this element

 > **html_input_type** (str | None): The input elements type or None if it is not an input element 
</details>

<details>
<summary>Attributes</summary>

 > **webi** (WebI): The WebI instance it was created from

 > **type** (str): The type/name of the element. Not to be confused with the input element's type

 > **attr** (dict): A collection of all attributes

 > **group** (Group | None): The group to which the element belongs
</details>

<details>
<summary>Methods</summary>

 > **get(_async)**: Returns the elements value or None if the application is not yet running<br>
    Equivalent to calling the instance (e.g: ```text_input()```)

 > **add(position, anchor, _async)**: Adds (registers) the element to the application

 > **on(event, _async)**: Registers an event handler.<br>
    To be used as a decorator

 > **remove_event_handler(event, handler, _async)**: Removes an existing event handler

 > **change_visibility(mode, _async)**: Shows / hides the element

 > **remove(_async)**: Removes the element from the application

 > **update_attr(attr, _async)**: Changes the values of the specified attributes.<br>
    Can add new attributes

 > **remove_attr(attribute_names, _async)**: Removes given attributes from the element
</details>

### MediaElement(Element)
```python
MediaElement(webi: WebI, element_type: str, attr: dict, html_tag: str, html_input_type: (str | None), src: (str | ndarray), format: str)
```
<details>
<summary>Parameters</summary>

*__MediaElement__ inherits parameters from its parent, __Element__*

 > **src** (str, ndarray): The source of the media. May be a file path or a numpy array

 > **format** (str): The file format of the source 
</details>

<details>
<summary>Attributes</summary>

*__MediaElement__ inherits attributes from its parent, __Element__*

 > **src** (str | ndarray): The source of the media

 > **format** (str): The file format of the source
</details>

<details>
<summary>Methods</summary>

*__MediaElement__ inherits methods from its parent, __Element__*

 > **change_src(src, format, _async)**: Changes the source of the element
</details>

### DrawingBoard(Element)
```python
DrawingBoard(webi: WebI, element_type: str, attr: dict, html_tag: str, html_input_type: (str | None))
```
<details>
<summary>Parameters</summary>

*__DrawingBoard__ inherits parameters from its parent, __Element__*

</details>

<details>
<summary>Attributes</summary>

*__DrawingBoard__ inherits attributes from its parent, __Element__*

</details>

<details>
<summary>Methods</summary>

*__DrawingBoard__ inherits methods from its parent, __Element__*

 > **toggle_eraser(erase, _async)**: Switches the eraser on or off depending on erase. erase = None will inverse the current setting.

 > **clear(_async)**: Clears the board.

 > **undo(_async)**: Removes the last stroke.

 > **get(res, _async)**: Returns the drawn image, scaled by res. 
</details>

### Group
```python
Group(webi: WebI, sort)
```

<details>
<summary>Parameters</summary>

 > **webi** (WebI): A WebI instance

 > **sort** (Boolean): If this group's elements should be sorted
</details>

<details>
<summary>Attributes</summary>

 > **webi** (WebI): The WebI instance it was created from

 > **members** (list): A list of all children elements

 > **group** (Group | None): The group to which the element belongs

 > **sort** (Boolean): Flag if this group's elements should be sorted
</details>

<details>
<summary>Methods</summary>

 > **add_members(members, _async)**: Add given members to this group

 > **remove_members(members, _async)**: Remove given members from this group

 > **disband(_async)**: Removes this group. Moves all members to the parent element

 > **order(elements_in_order, _async)**: Arranges the elements as given. Not all elements have to be provided.

 > **toggle_sort(sort, _async)**: Enables/Disables sorting.
</details>