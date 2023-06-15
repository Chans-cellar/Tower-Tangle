import * as THREE from "../node_modules/three/build/three.module.js";
import * as CANNON from 'cannon';
import {WebGLRenderer} from "three";
import {element, func} from "three/nodes";

//global variables
let scene, camera, renderer;
let world;

const initialBoxSize = 1.5;
const BoxHeight = 0.5;
let color;

let stack = [];
let overHangs = [];

let gameEnded = true

// const canvas = document.querySelector("#app");
const canvas = document.querySelector("#canvas");
const scoreText = document.querySelector('#scoreTxt');
const showables = document.querySelector('#showables');
const results = document.querySelector('#results');
scoreText.style.color = color





start();

function start() {
// CANNON JS
    world = new CANNON.World();
    world.gravity.set(0, -10, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 40;


// THREE JS
//create a scene
    scene = new THREE.Scene();

//add initial box
    addLayer(0, 0, initialBoxSize, initialBoxSize);
// add next box
    addLayer(-10, 0, initialBoxSize, initialBoxSize, 'x');


//add light
    const ambLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambLight);

    const directLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directLight.position.set(10, 20, 0);
    scene.add(directLight);


//add camera
    const width = 10;
    const height = width * (window.innerHeight / window.innerWidth);
    camera = new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 1, 100);
    camera.position.set(6, 6, 6);
    camera.lookAt(0, 0, 0)
    scene.add(camera)

//add renderer
    renderer = new THREE.WebGLRenderer({canvas});
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.render(scene, camera);
}

function playTrigger() {
    if (gameEnded) {
        renderer.setAnimationLoop(animation);
        gameEnded = false

    } else {

        const topLayer = stack[stack.length - 1];
        const previousLayer = stack[stack.length - 2];

        const currentDir = topLayer.direction;

        //calculate top layer overlap
        const distOffset = topLayer.threejs.position[currentDir] - previousLayer.threejs.position[currentDir];
        const overHangSize = Math.abs(distOffset);

        const size = currentDir === 'x' ? topLayer.width : topLayer.depth;

        const overlapSize = size - overHangSize;

        //if there is any overlap
        if (overlapSize > 0) {

            cutBox(topLayer, overlapSize, size, distOffset);

            //overhang
            const overHangShift = (overlapSize / 2 + overHangSize / 2) * Math.sign(distOffset);
            const overHangPosX =
                currentDir === 'x'
                    ? topLayer.threejs.position.x + overHangShift
                    : topLayer.threejs.position.x;
            const overHangPosZ =
                currentDir === 'z'
                    ? topLayer.threejs.position.z + overHangShift
                    : topLayer.threejs.position.z;
            const overHangWidth =
                currentDir === 'x'
                    ? overHangSize
                    : topLayer.width;
            const overHangDepth =
                currentDir === 'z'
                    ? overHangSize
                    : topLayer.depth;

            addOverHang(overHangPosX, overHangPosZ, overHangWidth, overHangDepth);


            //next box
            const nextX = currentDir === 'x' ? topLayer.threejs.position.x : -10;
            const nextZ = currentDir === 'z' ? topLayer.threejs.position.z : -10;
            const nextWidth = topLayer.width;
            const nextDepth = topLayer.depth;
            const nextDir = currentDir === 'x' ? 'z' : 'x';

            addLayer(nextX, nextZ, nextWidth, nextDepth, nextDir);

        }
    }
}

//add layer
function addLayer(x, z, width, depth, direction) {
    const y = BoxHeight * stack.length;

    const layer = spawnBox(x, y, z, width, depth, false);
    layer.direction = direction;

    scoreText.innerText = stack.length - 1;

    stack.push(layer);
}

//add over hang
function addOverHang(x, z, width, depth) {
    const y = BoxHeight * (stack.length - 1);

    const overHangBox = spawnBox(x, y, z, width, depth, true);
    overHangs.push(overHangBox);
}

function spawnBox(x, y, z, width, depth, falls) {

    //THREE JS
    //create a box
    const box = new THREE.BoxGeometry(width, BoxHeight, depth);

    //create a color
    color = new THREE.Color(`hsl(${30 + stack.length * 4}, 100%, 50%)`);//color changer
    const material = new THREE.MeshLambertMaterial({color});
    const mesh = new THREE.Mesh(box, material);
    mesh.position.set(x, y, z);
    scene.add(mesh);

    //add top stack color to score text
    scoreText.style.color =  '#' + color.getHex().toString(16) ;

    //CANNON JS
    const shape = new CANNON.Box(
        new CANNON.Vec3(width / 2, BoxHeight / 2, depth / 2)
    );
    let mass = falls ? 5 : 0;
    const body = new CANNON.Body({mass, shape})
    body.position.set(x, y, z);
    world.addBody(body);


    //return values
    return {
        threejs: mesh,
        cannonjs: body,
        width,
        depth
    }
}

function cutBox(topLayer, overlapSize, size, distOffset) {
    const currentDir = topLayer.direction;
    const newWidth = currentDir === 'x' ? overlapSize : topLayer.width;
    const newDepth = currentDir === 'z' ? overlapSize : topLayer.depth;

    //updating metadata
    topLayer.width = newWidth;
    topLayer.depth = newDepth;

    //actual update of the mesh
    topLayer.threejs.scale[currentDir] = overlapSize / size;
    topLayer.threejs.position[currentDir] -= distOffset / 2;

    //actual update of cannon body
    topLayer.cannonjs.position[currentDir] -= distOffset / 2;

    const newShape = new CANNON.Box(
        new CANNON.Vec3(newWidth / 2, BoxHeight / 2, newDepth / 2)
    )

    topLayer.cannonjs.shapes = [];
    topLayer.cannonjs.addShape(newShape);
}


//listen to the mouse click
// window.addEventListener("DOMContentLoaded", () => {
//     instructions.style.display = 'block';
// })

window.addEventListener("mousedown", playTrigger);
window.addEventListener("keydown", function (event) {
    if ((event.key === "R" || event.key === "r") && gameEnded) {
        location.reload();
    } else if (event.key === " ") {
        event.preventDefault();
        playTrigger();
    }
});

//this function iterated in every frame through animation loop
function animation() {
    const speed = 0.075;

    const topLayer = stack[stack.length - 1];
    topLayer.threejs.position[topLayer.direction] += speed; //THREE JS
    topLayer.cannonjs.position[topLayer.direction] += speed;

    if (camera.position.y < BoxHeight * (stack.length - 2) + 6) {
        camera.position.y += speed;
    }

    if (topLayer.threejs.position[topLayer.direction] > 10) {
        missedTheBlocks();
    }
    updatePhysics();
    renderer.render(scene, camera);
}

function updatePhysics() {
    world.step(1 / 60);

    overHangs.forEach((element) => {
        element.threejs.position.copy(element.cannonjs.position);
        element.threejs.quaternion.copy(element.cannonjs.quaternion);
    })
}

function missedTheBlocks() {
    gameEnded = true;
    results.style.display ='block';

}




