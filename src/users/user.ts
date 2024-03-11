import bodyParser from "body-parser";
import express from "express";
import { BASE_USER_PORT, REGISTRY_PORT, BASE_ONION_ROUTER_PORT } from "../config";
import { Node } from "@/src/registry/registry";
import { createRandomSymmetricKey, exportSymKey, rsaEncrypt, symEncrypt } from "../crypto";

export type SendMessageBody = {
  message: string;
  destinationUserId: number;
};

let lastCircuit: Node[] = [];
let lastReceivedMessage: string | null = null;
let lastSentMessage: string | null = null;

export async function user(userId: number) {
  const _user = express();
  _user.use(express.json());
  _user.use(bodyParser.json());

  _user.get("/status", (req, res) => {
    res.send("live");
  });

  _user.get("/getLastReceivedMessage", (req, res) => {
    res.json({ result: lastReceivedMessage });
  });

  _user.get("/getLastSentMessage", (req, res) => {
    res.json({ result: lastSentMessage });
  });

  _user.get("/getLastCircuit", (req, res) => {
    res.status(200).json({ result: lastCircuit.map((node) => node.nodeId) });
  });

  _user.post("/message", (req, res) => {
    const { message }: { message: string } = req.body;

    if (message) {
      lastReceivedMessage = message;
      res.status(200).send("success");
    } else {
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  _user.post("/sendMessage", async (req, res) => {
    const { message, destinationUserId }: { message: string; destinationUserId: number } = req.body;

    try {
      const response = await fetch(`http://localhost:${REGISTRY_PORT}/getNodeRegistry`);
      const data = await response.json();
      // @ts-ignore
      const nodes: Node[] = data.nodes;

      const selectedNodes: Node[] = [];

      while (selectedNodes.length < 3) {
        const randomNode = nodes[Math.floor(Math.random() * nodes.length)];
        if (!selectedNodes.includes(randomNode)) {
          selectedNodes.push(randomNode);
        }
      }

      const encryptedMessage = await encryptMessage(message, destinationUserId, selectedNodes);

      await fetch(`http://localhost:${BASE_ONION_ROUTER_PORT + selectedNodes[0].nodeId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: encryptedMessage })
      });

      lastSentMessage = message;
      lastCircuit = selectedNodes;

      res.status(200).json({ message: "Message sent successfully" });
    } catch (error) {
      // @ts-ignore
      console.error("Error sending message:", error.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const server = _user.listen(BASE_USER_PORT + userId, () => {
    console.log(`User ${userId} is listening on port ${BASE_USER_PORT + userId}`);
  });

  return server;
}

async function encryptMessage(message: string, destinationUserId: number, nodes: any[]): Promise<string> {
  let destination = `${BASE_USER_PORT + destinationUserId}`.padStart(10, "0");
  let finalMessage = message;

  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    const symmetricKey = await createRandomSymmetricKey();
    const symmetricKey64 = await exportSymKey(symmetricKey);
    const encryptedMessage = await symEncrypt(symmetricKey, `${destination + finalMessage}`);
    destination = `${BASE_ONION_ROUTER_PORT + node.nodeId}`.padStart(10, '0');
    const encryptedSymKey = await rsaEncrypt(symmetricKey64, node.pubKey);
    finalMessage = encryptedSymKey + encryptedMessage;
  }

  return finalMessage;
}
