// @ts-check
// Mesa, estações de agente e cadeira do usuário (mixin de WarRoomBuilder).
import { Avatar3D } from "../office-avatar.js";

export const warRoomTableMethods = {
  buildWarRoomTable(THREE, parentGroup, tx, tz) {
    const tableGroup = new THREE.Group();
    tableGroup.position.set(tx, 0, tz);

    const tableW = 4.4;
    const tableD = 2.4;
    const tableH = 0.76;

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.2, tableH - 0.05, 32),
      new THREE.MeshStandardMaterial({ color: 0x0b0f17, metalness: 0.9, roughness: 0.3 })
    );
    base.position.y = (tableH - 0.05) / 2;
    tableGroup.add(base);

    const topGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.06, 48);
    const topMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.2, metalness: 0.85, transparent: true, opacity: 0.92 });
    const topMesh = new THREE.Mesh(topGeo, topMat);
    topMesh.scale.set(tableW / 3.2, 1.0, tableD / 3.2);
    topMesh.position.y = tableH;
    topMesh.userData = { id: "war_room_table_console" };
    tableGroup.add(topMesh);
    this.interactionManager.addInteractiveMesh(topMesh);

    // Borda iluminada
    const edgeRing = new THREE.Mesh(
      new THREE.RingGeometry(1.58, 1.61, 48),
      new THREE.MeshBasicMaterial({ color: 0x00d2ff, side: THREE.DoubleSide })
    );
    edgeRing.rotation.x = -Math.PI / 2;
    edgeRing.scale.set(tableW / 3.2, tableD / 3.2, 1.0);
    edgeRing.position.y = tableH + 0.032;
    tableGroup.add(edgeRing);

    // Console Holográfico Central
    const holoBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.46, 0.05, 32),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 })
    );
    holoBase.position.y = tableH + 0.04;
    tableGroup.add(holoBase);

    this.holoCoreMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18, 0),
      new THREE.MeshBasicMaterial({ color: 0x00d2ff, wireframe: true })
    );
    this.holoCoreMesh.position.y = tableH + 0.35;
    tableGroup.add(this.holoCoreMesh);

    // Estações dos Agentes
    this.buildAgentStation(THREE, tableGroup, -2.15, 0, Math.PI / 2, {
      id: "war_room_claude_station",
      color: 0xd97757,
      agentKey: "claude"
    });

    this.buildAgentStation(THREE, tableGroup, 2.15, 0, -Math.PI / 2, {
      id: "war_room_gemini_station",
      color: 0x5c87f2,
      agentKey: "gemini"
    });

    this.buildAgentStation(THREE, tableGroup, 0, -1.65, 0, {
      id: "war_room_opencode_station",
      color: 0x3cb371,
      agentKey: "opencode"
    });

    // Cadeira do Operador/Usuário
    this.buildAgentStation(THREE, tableGroup, 0, 1.65, Math.PI, {
      id: "war_room_codex_station",
      color: 0x22c55e,
      agentKey: "codex"
    });
    this.buildUserBoardChair(THREE, tableGroup, 0, 2.25, Math.PI);

    parentGroup.add(tableGroup);
  },

  buildAgentStation(THREE, parentTableGroup, localX, localZ, yaw, agentMeta) {
    const stationGroup = new THREE.Group();
    stationGroup.position.set(localX, 0, localZ);
    stationGroup.rotation.y = yaw;

    const seatMat = new THREE.MeshStandardMaterial({ color: 0x18202f, roughness: 0.6 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.08, 0.52), seatMat);
    seat.position.y = 0.44;
    stationGroup.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.65, 0.06), seatMat);
    back.position.set(0, 0.78, -0.24);
    stationGroup.add(back);

    const accent = new THREE.Mesh(new THREE.BoxGeometry(0.53, 0.03, 0.07), new THREE.MeshBasicMaterial({ color: agentMeta.color }));
    accent.position.set(0, 1.08, -0.24);
    stationGroup.add(accent);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.38, 16), new THREE.MeshStandardMaterial({ color: 0x0b0f17, metalness: 0.9 }));
    stem.position.y = 0.2;
    stationGroup.add(stem);

    seat.userData = { id: agentMeta.id };
    this.interactionManager.addInteractiveMesh(seat);

    // Avatar do Agente Sentado
    const agentAvatar = new Avatar3D(THREE, { accentColor: agentMeta.color, name: `Avatar_${agentMeta.agentKey}` });
    agentAvatar.position.set(0, 0, 0);
    agentAvatar.rotation = 0;
    agentAvatar.targetRotation = 0;
    agentAvatar.setState(agentMeta.agentKey === "opencode" ? "sit" : "typing");
    agentAvatar.update(0.1);
    stationGroup.add(agentAvatar.root);
    this.agents3D[agentMeta.agentKey] = agentAvatar;

    // Display holográfico na mesa
    const padGroup = new THREE.Group();
    padGroup.position.set(0, 0.77, 0.72);
    padGroup.rotation.x = -0.25;

    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.015, 0.28), new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85 }));
    padGroup.add(pad);

    const padScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.39, 0.25), new THREE.MeshBasicMaterial({ color: agentMeta.color }));
    padScreen.rotation.x = -Math.PI / 2;
    padScreen.position.y = 0.009;
    padGroup.add(padScreen);
    this.agentPads[agentMeta.agentKey] = padScreen;

    stationGroup.add(padGroup);
    parentTableGroup.add(stationGroup);
  },

  buildUserBoardChair(THREE, parentTableGroup, localX, localZ, yaw) {
    const chairGroup = new THREE.Group();
    chairGroup.position.set(localX, 0, localZ);
    chairGroup.rotation.y = yaw;

    const seatMat = new THREE.MeshStandardMaterial({ color: 0x1f293d, roughness: 0.5 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.08, 0.54), seatMat);
    seat.position.y = 0.44;
    chairGroup.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.75, 0.06), seatMat);
    back.position.set(0, 0.84, -0.26);
    chairGroup.add(back);

    const ledTop = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.03, 0.07), new THREE.MeshBasicMaterial({ color: 0x00d2ff }));
    ledTop.position.set(0, 1.2, -0.26);
    chairGroup.add(ledTop);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.38, 16), new THREE.MeshStandardMaterial({ color: 0x0b0f17, metalness: 0.9 }));
    stem.position.y = 0.2;
    chairGroup.add(stem);

    seat.userData = { id: "war_room_user_chair" };
    parentTableGroup.add(chairGroup);
    this.interactionManager.addInteractiveMesh(seat);
  },
};
