from quart import Quart
from quart import render_template
from quart import request
from quart import make_response
from quart import send_file
import socketio as pysocketio
import asyncio
from hypercorn.config import Config
from hypercorn.asyncio import serve
import io
import signal
import copy

class Server:
    def __init__(self, port, event_handler, webi):
        self.app = Quart(__name__)
        self.socketio = pysocketio.AsyncServer(async_mode='asgi')
        self.socketio_app = pysocketio.ASGIApp(self.socketio, self.app)

        self.config = Config()
        self.config.bind = [f"127.0.0.1:{port}"]
        self.app.config['MAX_CONTENT_LENGTH'] = 1000 * 1024 * 1024 # 1GB
        self.shutdown_trigger = None

        self.event_handler = event_handler

        self.file_storage = {}

        self.onstart = []
        self.started = False
        self.ended = False
        self.event_queue = []
        self.connected = False

        self.sid = None

        self.webi = webi
        self.entry_point = {}

        self.routes()

    def routes(self):
        @self.app.route("/")
        async def index():
            return await render_template("app.html")
        
        @self.app.route("/file_upload", methods=["POST"])
        async def file_upload():
            element_id = (await request.form).get("id")
            files = (await request.files).getlist(element_id)
            element_id = element_id

            value = []
            for f in files:
                buffer = io.BytesIO()
                f.stream.seek(0)
                buffer.write(f.stream.read())
                buffer.seek(0)
                value.append({
                    "file": buffer,
                    "name": f.filename,
                    "base": "".join(f.filename.split(".")[:-1]),
                    "extension": f.filename.split(".")[-1],
                    "type": f.mimetype.split("/")[0],
                    "format": f.mimetype.split("/")[-1]
                })
                
            await self.event_handler("value_response", element_id, value)

            response = await make_response("OK")
            response.headers["Access-Control-Allow-Origin"] = "*"
            return response

        @self.app.route("/get_file", methods=["GET"])
        async def get_file():
            element_id = request.args.get("id")
            file = self.file_storage.pop(element_id, None)

            if file is None:
                return f"No file found for id = {element_id}", 400
            
            return await send_file(file["src"], mimetype = file["mimetype"])
        
        ## Connection ##
        @self.socketio.on("connect")
        async def connection(id, env, auth):
            print("Connected: ", id)

            if not self.connected:
                self.sid = id
                self.connected = True

                if self.started:
                    self.restore_entry_point()
                else:
                    self.started = True

                for event in self.onstart:
                    await self.socketio.emit(*event)
            else:
                await self.socketio.emit("disconnect_client", "WebInter doesn't support multiple clients.", to=id)
        
        @self.socketio.on("disconnect")
        async def connection(id):
            print("Disconnected: ", id)
            if id == self.sid:
                self.connected = False
                
        @self.socketio.on("reconnect_attempt")
        async def handle_reconnecting(id):
            print("Reconnecting: ", id)

        @self.socketio.on("reconnect_failed")
        async def handle_reconnecting(id):
            print("Reconnect failed: ", id)
        
        ## Events ##
        @self.socketio.on("element_event")
        async def on_element_event(socket_id, type, element_id, value):
            await self.event_handler(type, element_id, value)
        
        @self.socketio.on("error")
        async def on_error(id, msg):
            raise Exception(f"[ERROR]: {msg}")
        
    def set_entry_point(self):
        self.entry_point["handlers"] = copy.deepcopy(self.webi.handlers)

        self.entry_point["elements"] = {}
        for el_id, el in self.webi.elements.items():
            self.entry_point["elements"][el_id] = copy.copy(el.__dict__)
            self.entry_point["elements"][el_id]["webi"] = self.webi

        self.entry_point["groups"] = {}
        for gp_id, gp in self.webi.groups.items():
            self.entry_point["groups"][gp_id] = copy.copy(gp.__dict__)
            self.entry_point["groups"][gp_id]["webi"] = self.webi
    
    def restore_entry_point(self):
        self.webi.handlers = copy.deepcopy(self.entry_point["handlers"])

        for element_id in copy.copy(self.webi.elements):
            if element_id in self.entry_point["elements"]:
                self.webi.elements[element_id].__dict__.update(self.entry_point["elements"][element_id])
            else:
                self.webi.elements[element_id].webi = None
                del self.webi.elements[element_id]

        for group_id in copy.copy(self.webi.groups):
            if group_id in self.entry_point["groups"]:
                self.webi.groups[group_id].__dict__.update(self.entry_point["groups"][group_id])
            else:
                self.webi.groups[group_id].webi = None
                del self.webi.groups[group_id]
    
    async def _emit(self, event, *data):
        if self.ended:
            raise Exception("The server has been shut down")
        if not self.started:
            self.onstart.append((event, data))
            return
        
        await self.socketio.emit(event, data)

    async def shutdown(self):
        if self.shutdown_trigger is None:
            raise Exception("The server has not been started yet!")

        if self.connected:
            await self.socketio.emit("shutdown")
        self.shutdown_trigger.set()

    def run(self):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        self.shutdown_trigger = asyncio.Event()

        def shutdown(*_):
            loop.create_task(self.shutdown())
        
        signal.signal(signal.SIGINT, shutdown)
        signal.signal(signal.SIGTERM, shutdown)

        self.set_entry_point()
        loop.run_until_complete(serve(self.socketio_app, self.config, shutdown_trigger=self.shutdown_trigger.wait))
        self.started = False
        self.ended = True