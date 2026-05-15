let world = new Map();

// =========================
// SETTINGS
// =========================

const chunkSize = 16;
const renderDistance = 0.5;
const worldHeight = 24;
const blockSize = 32;
const eyeHeight = 50;

const AIR = 0;
const GRASS = 1;
const STONE = 2;
const WOOD = 3;
const LEAVES = 4;
const BRICK = 5;
const CHEST = 6;

// =========================
// BLOCK BREAK SETTINGS
// =========================

const breakTimes = {
  [GRASS]: 20,
  [STONE]: 55,
  [WOOD]: 40,
  [LEAVES]: 8,
  [BRICK]: 65,
  [CHEST]: 30
};

let breakingBlock = null;
let breakProgress = 0;

// =========================
// PLAYER
// =========================

let pX = 0;
let pY = -300;
let pZ = 0;

let rotX = 0;
let rotY = 0;

let velocityY = 0;
let isGrounded = false;

const playerHeight = 55;
const playerRadius = 10;

// =========================
// GAME
// =========================

let lootMessage = "";
let lootTimer = 0;

let structures = new Set();

let selectedBlock = STONE;

// =========================
// PRELOAD
// =========================

function preload() {
  myFont = loadFont('https://cdnjs.cloudflare.com/ajax/libs/topcoat/0.8.0/font/SourceCodePro-Bold.otf');
}

// =========================
// SETUP
// =========================

function setup() {

  createCanvas(windowWidth, windowHeight, WEBGL);

  noiseSeed(5);

  textFont(myFont);

  document.body.style.overflow = "hidden";
}

// =========================
// MAIN LOOP
// =========================

function draw() {

  background(120, 190, 255);

  handleInput();
  handlePhysics();
  handleBlockBreaking();

  let eyeY = pY - eyeHeight;

  let lookX = sin(rotY) * cos(rotX);
  let lookY = sin(rotX);
  let lookZ = -cos(rotY) * cos(rotX);

  camera(
    pX, eyeY, pZ,
    pX + lookX, eyeY + lookY, pZ + lookZ,
    0, 1, 0
  );

  directionalLight(255,255,255,-1,-1,-1);
  ambientLight(120);

  perspective(
    PI/3,
    width/height,
    0.1,
    10000
  );

  renderWorld();

  drawCursor();

  drawUI();
}

// =========================
// WORLD STORAGE
// =========================

function keyXYZ(x,y,z){
  return `${x},${y},${z}`;
}

function getBlock(x,y,z){
  return world.get(keyXYZ(x,y,z)) || 0;
}

function setBlock(x,y,z,type){

  if(type === 0){
    world.delete(keyXYZ(x,y,z));
  } else {
    world.set(keyXYZ(x,y,z), type);
  }
}

// =========================
// CHUNKS
// =========================

function generateChunk(cx,cz){

  const chunkID = `${cx},${cz}`;

  if(structures.has(chunkID)) return;

  structures.add(chunkID);

  for(let x=0;x<chunkSize;x++){
    for(let z=0;z<chunkSize;z++){

      let wx = cx*chunkSize + x;
      let wz = cz*chunkSize + z;

      let h = floor(noise(wx*0.05,wz*0.05)*8)+4;

      // =========================
      // CAVES
      // =========================

      for(let y=0;y<h;y++){

        let caveNoise =
          noise(wx*0.09,y*0.09,wz*0.09);

        // AIR CAVE
        if(caveNoise > 0.63 && y > 2){
          continue;
        }

        if(y === h-1){
          setBlock(wx,y,wz,GRASS);
        } else {
          setBlock(wx,y,wz,STONE);
        }
      }

      // =========================
      // SAFE STRUCTURE SPAWNING
      // =========================

      let solidGround = 
        getBlock(wx, h - 1, wz) === GRASS && 
        getBlock(wx, h, wz) === AIR;

      if (solidGround) {
        let roll = random();

        // TREE SPAWN
        if (roll < 0.005) {
          if (isAreaClear(wx - 1, h, wz - 1, 3, 6, 3)) {
            spawnTree(wx, h, wz);
          }
        } 
        // HOUSE SPAWN
        else if (roll < 0.006) {
          if (isAreaClear(wx - 1, h, wz - 1, 7, 6, 7)) {
            spawnHouse(wx, h, wz);
          }
        }
      }
    }
  }
}

// =========================
// TREES
// =========================

function spawnTree(x,y,z){

  let h = floor(random(3,6));

  for(let i=0;i<h;i++){
    setBlock(x,y+i,z,WOOD);
  }

  for(let lx=-2;lx<=2;lx++){
    for(let ly=-2;ly<=2;ly++){
      for(let lz=-2;lz<=2;lz++){

        if(abs(lx)+abs(ly)+abs(lz) < 4){

          setBlock(
            x+lx,
            y+h-1+ly,
            z+lz,
            LEAVES
          );
        }
      }
    }
  }
}

// =========================
// STRUCTURES
// =========================

function isAreaClear(startX, startY, startZ, w, h, d) {
  for (let x = startX; x < startX + w; x++) {
    for (let y = startY; y < startY + h; y++) {
      for (let z = startZ; z < startZ + d; z++) {
        if (getBlock(x, y, z) !== AIR) return false;
      }
    }
  }
  return true;
}

function spawnHouse(x,y,z){

  // =========================
  // FLOOR
  // =========================

  for(let xx=0; xx<5; xx++){
    for(let zz=0; zz<5; zz++){

      setBlock(x+xx, y, z+zz, BRICK);
    }
  }

  // =========================
  // WALLS
  // =========================

  for(let yy=1; yy<4; yy++){

    for(let xx=0; xx<5; xx++){
      for(let zz=0; zz<5; zz++){

        let edge =
          xx===0 || xx===4 ||
          zz===0 || zz===4;

        if(edge){
          setBlock(x+xx, y+yy, z+zz, WOOD);
        }
      }
    }
  }

  // =========================
  // ROOF
  // =========================

  for(let xx=-1; xx<6; xx++){
    for(let zz=-1; zz<6; zz++){

      setBlock(x+xx, y+4, z+zz, BRICK);
    }
  }

  // =========================
  // DOOR
  // =========================

  setBlock(x+2, y+1, z, AIR);
  setBlock(x+2, y+2, z, AIR);

  // =========================
  // CHEST
  // =========================

  setBlock(x+3, y+1, z+3, CHEST);
}

// =========================
// RENDERING
// =========================

function renderWorld(){

  let pcx = floor(pX/blockSize/chunkSize);
  let pcz = floor(pZ/blockSize/chunkSize);

  for(let cx=pcx-renderDistance; cx<=pcx+renderDistance; cx++){
    for(let cz=pcz-renderDistance; cz<=pcz+renderDistance; cz++){

      generateChunk(cx,cz);
    }
  }

  if(frameCount === 1){

    let ground = floor(noise(0,0)*8)+4;

    pX = 0;
    pZ = 0;

    for(let i=ground+10;i<worldHeight+50;i++){

      let testY = -i*blockSize;

      if(!checkCollision(pX,testY,pZ)){

        pY = testY;
        break;
      }
    }
  }

  for(let [k,type] of [...world]){

    if(type === AIR) continue;

    let parts = k.split(",");

    let x = int(parts[0]);
    let y = int(parts[1]);
    let z = int(parts[2]);

    let wx = x * blockSize;
    let wy = -y * blockSize;
    let wz = z * blockSize;

    // DISTANCE CULLING
    let dx = wx-pX;
    let dz = wz-pZ;

    let maxDist =
      renderDistance *
      chunkSize *
      blockSize;

    if(dx*dx + dz*dz > maxDist*maxDist){
      continue;
    }

    let visible = false;

    if(getBlock(x+1,y,z) === AIR) visible = true;
    if(getBlock(x-1,y,z) === AIR) visible = true;
    if(getBlock(x,y+1,z) === AIR) visible = true;
    if(getBlock(x,y-1,z) === AIR) visible = true;
    if(getBlock(x,y,z+1) === AIR) visible = true;
    if(getBlock(x,y,z-1) === AIR) visible = true;

    if(!visible) continue;

    push();

    translate(wx,wy,wz);

    let scaleSize = blockSize;

    if(
      breakingBlock &&
      breakingBlock.x === x &&
      breakingBlock.y === y &&
      breakingBlock.z === z
    ){

      let t =
        breakProgress /
        (breakTimes[type] || 30);

      scaleSize =
        lerp(blockSize, blockSize*0.5, t);
    }

    blockColor(type);

    box(scaleSize);

    pop();
  }
}

// =========================
// COLORS
// =========================

function blockColor(t){

  if(t===GRASS) fill(50,190,50);
  else if(t===STONE) fill(130);
  else if(t===WOOD) fill(120,80,40);
  else if(t===LEAVES) fill(40,140,40);
  else if(t===BRICK) fill(170,70,70);
  else if(t===CHEST) fill(220,170,40);
}

// =========================
// INPUT
// =========================

function handleInput() {
  const speed = 5;
  let dx = 0;
  let dz = 0;

  if (keyIsDown(87)) { dx += sin(rotY); dz -= cos(rotY); }
  if (keyIsDown(83)) { dx -= sin(rotY); dz += cos(rotY); }
  if (keyIsDown(65)) { dx -= cos(rotY); dz -= sin(rotY); }
  if (keyIsDown(68)) { dx += cos(rotY); dz += sin(rotY); }

  let len = Math.hypot(dx, dz);
  if (len > 0) {
    dx = (dx / len) * speed;
    dz = (dz / len) * speed;
  }

  // X AXIS
  if (!checkCollision(pX + dx, pY, pZ)) {
    pX += dx;
  }
  // Z AXIS
  if (!checkCollision(pX, pY, pZ + dz)) {
    pZ += dz;
  }
}

// =========================
// PHYSICS
// =========================

function handlePhysics() {
  velocityY += 0.35;
  velocityY = constrain(velocityY, -50, 12);

  let steps = ceil(abs(velocityY));
  let stepAmount = velocityY / steps;

  for (let i = 0; i < steps; i++) {
    let ny = pY + stepAmount;

    if (checkCollision(pX, ny, pZ)) {
      if (velocityY > 0) {
        isGrounded = true;
        let blockYIndex = floor((-ny + blockSize/2) / blockSize);
        pY = (-blockYIndex * blockSize) - (blockSize/2) - 0.01;
      } else if (velocityY < 0) {
        velocityY = 0;
      }
      velocityY = 0;
      break; 
    } else {
      pY = ny;
      isGrounded = false;
    }
  }
}

// =========================
// COLLISION
// =========================

function checkCollision(x, y, z) {
  const margin = 0.05; 

  let pMinX = x - playerRadius + margin;
  let pMaxX = x + playerRadius - margin;
  let pMinY = y - playerHeight + margin;
  let pMaxY = y - margin;
  let pMinZ = z - playerRadius + margin;
  let pMaxZ = z + playerRadius - margin;
  
  let startX = floor((pMinX + blockSize/2) / blockSize);
  let endX   = floor((pMaxX + blockSize/2) / blockSize);
  let startZ = floor((pMinZ + blockSize/2) / blockSize);
  let endZ   = floor((pMaxZ + blockSize/2) / blockSize);
  
  let startY = floor((-pMaxY + blockSize/2) / blockSize);
  let endY   = floor((-pMinY + blockSize/2) / blockSize);

  for (let bx = startX; bx <= endX; bx++) {
    for (let by = startY; by <= endY; by++) {
      for (let bz = startZ; bz <= endZ; bz++) {
        if (getBlock(bx, by, bz) !== AIR) {
          return true; 
        }
      }
    }
  }
  return false;
}

// =========================
// RAYCAST
// =========================

function raycast() {
  let maxDist = 200;
  let eyeY = pY - eyeHeight;
  let dirX = sin(rotY) * cos(rotX);
  let dirY = sin(rotX);
  let dirZ = -cos(rotY) * cos(rotX);

  let lastX = floor(pX / blockSize);
  let lastY = floor(-eyeY / blockSize);
  let lastZ = floor(pZ / blockSize);

  for (let d = 0; d < maxDist; d += 0.1) {
    let rx = pX + dirX * d;
    let ry = eyeY + dirY * d;
    let rz = pZ + dirZ * d;

    let bx = floor(rx / blockSize);
    let by = floor(-ry / blockSize);
    let bz = floor(rz / blockSize);

    if (getBlock(bx, by, bz) !== AIR) {
      return { 
        hit: { x: bx, y: by, z: bz }, 
        prev: { x: lastX, y: lastY, z: lastZ } 
      };
    }
    
    lastX = bx; 
    lastY = by; 
    lastZ = bz;
  }
  return null;
}

// =========================
// BLOCK BREAKING
// =========================

function handleBlockBreaking(){

  if(mouseIsPressed && mouseButton === LEFT){

    let result = raycast();
    if(!result || !result.hit){
      breakingBlock = null;
      breakProgress = 0;
      return;
    }

    let hit = result.hit;

    if(
      !breakingBlock ||
      hit.x !== breakingBlock.x ||
      hit.y !== breakingBlock.y ||
      hit.z !== breakingBlock.z
    ){
      breakingBlock = hit;
      breakProgress = 0;
    }

    let type =
      getBlock(hit.x,hit.y,hit.z);

    breakProgress++;

    if(
      breakProgress >=
      (breakTimes[type] || 30)
    ){
      if (type === CHEST) {
        let loot = ["gold", "diamond", "apple", "stone", "wood"];
        let item = random(loot);

        lootMessage = "LOOT FOUND: " + item.toUpperCase();
        lootTimer = 180; 
      }

      setBlock(hit.x,hit.y,hit.z,0);

      breakingBlock = null;
      breakProgress = 0;
    }

  } else {

    breakingBlock = null;
    breakProgress = 0;
  }
}

// =========================
// MOUSE
// =========================

function mouseMoved(){

  rotY += movedX * 0.0025;
  rotX += movedY * 0.0025;

  rotX = constrain(rotX,-1.5,1.5);
}

function mousePressed() {
  let result = raycast();
  if (!result) return;

  if (mouseButton === RIGHT) {
    let { prev } = result;

    if (getBlock(prev.x, prev.y, prev.z) === AIR) {
      
      setBlock(prev.x, prev.y, prev.z, selectedBlock);

      if (checkCollision(pX, pY, pZ)) {
        setBlock(prev.x, prev.y, prev.z, AIR);
      }
    }
  }
}

// =========================
// HUD
// =========================

function drawUI() {
  push();
  resetMatrix(); 

  ortho();
  
  let gl = canvas.getContext('webgl');
  gl.disable(gl.DEPTH_TEST);

  stroke(255);
  strokeWeight(2);
  line(-10, 0, 10, 0);
  line(0, -10, 0, 10);

  if (lootTimer > 0) {
    noStroke();
    fill(0, 255, 255);
    textSize(24);
    textAlign(LEFT, TOP);
    
    text(lootMessage, -width/2 + 20, -height/2 + 20);
    
    lootTimer--;
  }

  gl.enable(gl.DEPTH_TEST);
  pop();
}

// =========================
// CURSOR DRAWING
// =========================

function drawCursor() {
  if (!keyIsDown(78)) return;

  let result = raycast();
  
  if (result && result.prev) {
    let { x, y, z } = result.prev;
    
    push();
    translate(x * blockSize, -y * blockSize, z * blockSize);
    
    noFill();
    stroke(255, 255, 255);
    strokeWeight(4);
    
    box(blockSize * 1.05); 
    pop();
  }
}

// =========================
// KEYS
// =========================

function keyPressed(){

  if(key === " " && isGrounded){

    velocityY = -8;
  }

  if(key === "1") selectedBlock = GRASS;
  if(key === "2") selectedBlock = STONE;
  if(key === "3") selectedBlock = WOOD;
  if(key === "4") selectedBlock = LEAVES;
  if(key === "5") selectedBlock = BRICK;
}

function windowResized(){

  resizeCanvas(
    windowWidth,
    windowHeight
  );
}

document.oncontextmenu = () => false;
