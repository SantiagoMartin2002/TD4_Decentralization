import bodyParser from "body-parser";
import express from "express";
import { REGISTRY_PORT } from "../config";
import * as console from "console";

export type Node = { nodeId: number; pubKey: string};

export type RegisterNodeBody = {
  nodeId: number;
  pubKey: string;
};

export type GetNodeRegistryBody = {
  nodes: Node[];
};

export async function launchRegistry() {
  const _registry = express();

  let registeredNodes: GetNodeRegistryBody = { nodes: [] };

  _registry.use(express.json());
  _registry.use(bodyParser.json());


  _registry.get("/status", (req, res) => {
    res.send("live");
  });

  _registry.post("/registerNode", (req, res) => {
      const { nodeId, pubKey }: RegisterNodeBody = req.body;
      const newNode: Node = { nodeId, pubKey };
      registeredNodes.nodes.push(newNode);
      res.status(201).json({ message: "Node registered successfully" });
  });

  _registry.get("/getNodeRegistry", (req, res) => {
    res.json(registeredNodes);
  });

  const server = _registry.listen(REGISTRY_PORT, () => {
    console.log(`Registry is listening on port ${REGISTRY_PORT}`);
  });

  return server;
}
