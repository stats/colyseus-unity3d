import { Room, Client, generateId } from "colyseus";
import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { verifyToken, User, IUser } from "@colyseus/social";

class Entity extends Schema {
  @type("number")
  x: number = 0;

  @type("number")
  y: number = 0;
}

class Player extends Entity {
  @type("boolean")
  connected: boolean = true;
}

class Enemy extends Entity {
  @type("number")
  power: number = Math.random() * 10;
}

class State extends Schema {
  @type({ map: Entity })
  entities = new MapSchema<Entity>();
}

/**
 * Demonstrate sending schema data types as messages
 */
class Message extends Schema {
  @type("number") num;
  @type("string") str;
}

export class DemoRoom extends Room {

  onCreate (options: any) {
    console.log("DemoRoom created!", options);

    this.setState(new State());
    this.populateEnemies();

    this.setMetadata({
      str: "hello",
      number: 10
    });

    this.setPatchRate(1000 / 20);
    this.setSimulationInterval((dt) => this.update(dt));
  }

  async onAuth (client, options) {
    console.log("onAuth(), options!", options);
    return await User.findById(verifyToken(options.token)._id);
  }

  populateEnemies () {
    for (let i=0; i<=3; i++) {
      const enemy = new Enemy();
      enemy.x = Math.random() * 2;
      enemy.y = Math.random() * 2;
      this.state.entities[generateId()] = enemy;
    }
  }

  onJoin (client: Client, options: any, user: IUser) {
    console.log("client joined!", client.sessionId);
    this.state.entities[client.sessionId] = new Player();
  }

  async onLeave (client: Client, consented: boolean) {
    this.state.entities[client.sessionId].connected = false;

    try {
      if (consented) {
        throw new Error("consented leave!");
      }

      console.log("let's wait for reconnection!")
      const newClient = await this.allowReconnection(client, 10);
      console.log("reconnected!", newClient.sessionId);

    } catch (e) {
      console.log("disconnected!", client.sessionId);
      delete this.state.entities[client.sessionId];
    }
  }

  onMessage (client: Client, data: any) {
    console.log(data, "received from", client.sessionId);

    if (data === "move_right") {
      this.state.entities[client.sessionId].x += 0.01;

      const message = new Message();
      message.num = Math.floor(Math.random() * 100);
      message.str = "sending to a single client";
      this.send(client, message);
    }
    if ( data === "move_left") {
      const enemy = new Enemy();
      enemy.x = 547;
      enemy.y = 547;
      let key = generateId();
      console.log("Adding enemy: ", key)
      this.state.entities[key] = enemy;
    }
    console.log(this.state.entities[client.sessionId].x);

    this.broadcast({ hello: "hello world" });
  }

  update (dt?: number) {
    // console.log("num clients:", Object.keys(this.clients).length);
    for(let key in this.state.entities) {
      const enemy = this.state.entities[key];
      if(enemy.x == 547 && enemy.y == 547) {
        console.log("Removing enemy", key);
        delete this.state.entities[key];
      }
    }
  }

  onDispose () {
    console.log("disposing DemoRoom...");
  }

}
