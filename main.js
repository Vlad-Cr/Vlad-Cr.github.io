'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let BackgroundVideoModel;
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.

let CanvasWidth;
let CanvasHeight;
let SurfaceTexture;

let TextureWebCam;
let video;

let SensorAlpha = 0.0;
let SensorBeta = 0.0;
let SensorGamma = 0.0;

let AudioSphere;
let sound = { audioCtx: null, source: null, panner: null, filter: null }
let audioSource = null

let sphereRadius = 0.3

let sphereX = 0
let sphereY = 0
let sphereZ = 0

function deg2rad(angle) {
    return angle * Math.PI / 180;
}

// Constructor
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iTextureBuffer = gl.createBuffer();

    this.count = 0;

    this.BufferData = function(vertices, texCoords) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTextureBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STREAM_DRAW);

        this.count = vertices.length/3;
    }

    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTextureBuffer);
        gl.vertexAttribPointer(shProgram.iTextureCoords, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iTextureCoords);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.count);
    }
}

// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    this.iAttribVertex = -1;
    this.iTextureCoords = -1;

    this.iColor = -1;

    this.iModelViewProjectionMatrix = -1;

    this.iTexture = -1;
   
    this.Use = function() {
        gl.useProgram(this.prog);
    }
}

function draw() { 
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    DrawWebCamVideo();

    gl.clear(gl.DEPTH_BUFFER_BIT);

    DrawSurface();
    DrawSphere();
}

function DrawSphere()
{
    let ModelView = spaceball.getViewMatrix()//getRotationMatrix(SensorAlpha, SensorBeta, SensorGamma)
    let WorldMatrix = m4.translation(0, 0, -30);
    let ProjectionMatrix = m4.perspective(Math.PI / 8, 1, 1, 100)

    let WorldViewMatrix = m4.multiply(ModelView, WorldMatrix );
    let ModelViewProjection = m4.multiply(ProjectionMatrix, WorldViewMatrix);

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, ModelViewProjection );

    gl.uniform4fv(shProgram.iColor, [1.0,1.0,1.0,1] )

    if (sound.panner) 
    {
        let Position = multiplyMatrixAndPoint(WorldViewMatrix, [1, 1, 1, 1])

        sound.panner.positionX.value = Position[0]
        sound.panner.positionY.value = Position[1]
        sound.panner.positionZ.value = Position[2]

        document.getElementById('sphereX').innerHTML = 'Sphere X: ' + Position[0]
        document.getElementById('sphereY').innerHTML = 'Sphere Y: ' + Position[1]
        document.getElementById('sphereZ').innerHTML = 'Sphere Z: ' + Position[2]
    }

    AudioSphere.Draw()
}

function DrawSurface()
{
    let ModelView = m4.translation(0, 0, 0);
    let WorldMatrix = m4.translation(0, 0, -15);
    let ProjectionMatrix = m4.perspective(Math.PI / 8, 1, 1, 100)

    let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7)
    let matAccum0 = m4.multiply(rotateToPointZero, ModelView)

    let WorldViewMatrix = m4.multiply(WorldMatrix, matAccum0 );
    let ModelViewProjection = m4.multiply(ProjectionMatrix, WorldViewMatrix);

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, ModelViewProjection );

    gl.uniform4fv(shProgram.iColor, [0.0,0.0,0.0,1] );

    gl.bindTexture(gl.TEXTURE_2D, SurfaceTexture);
    gl.uniform1i(shProgram.iTexture, 0);
    
    surface.Draw();
}

function DrawWebCamVideo()
{
    gl.uniform4fv(shProgram.iColor, [0.0,0.0,0.0,1])

    gl.bindTexture(gl.TEXTURE_2D, TextureWebCam);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    
    let ViewMatrix = m4.translation(0, 0, 0);
    let projection = m4.orthographic(-CanvasWidth / 2.0, CanvasWidth / 2.0, -CanvasHeight / 2.0, CanvasHeight / 2.0, 1.0, 20000);

    let WorldViewMatrix = m4.multiply(m4.translation(0, 0, -100), ViewMatrix);
    let ModelViewProjection = m4.multiply(projection, WorldViewMatrix);

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, ModelViewProjection );
    
    gl.uniform1i(shProgram.iTexture, 0);

    BackgroundVideoModel.Draw();
}

function CreateBackgroundData()
{
    let vertexList = [-CanvasWidth / 2.0, -CanvasHeight / 2.0, 0,
                        -CanvasWidth / 2.0, CanvasHeight / 2.0, 0,
                        CanvasWidth / 2.0, CanvasHeight / 2.0, 0,
                        -CanvasWidth / 2.0, -CanvasHeight / 2.0, 0,
                        CanvasWidth / 2.0, CanvasHeight / 2.0, 0,
                        CanvasWidth / 2.0, -CanvasHeight / 2.0, 0];
    let textCoords = [1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1];

    return [vertexList, textCoords];
}

function CreateSurfaceData()
{
    let step = 1.0;
    let uend = 360 + step;
    let vend = 90 + step;
    let DeltaU = 0.0001;
    let DeltaV = 0.0001;

    let vertexList = [];
    let textCoords = [];

    for (let u = 0; u < uend; u += step) {
        for (let v = 0; v < vend; v += step) {
            let unext = u + step;

            /*
            *-------*
            |       |
            |       |
            0-------*
            */
            let x = CalcX(u, v);
            let y = CalcY(u, v);
            let z = CalcZ(u, v);
            vertexList.push( x, y, z );

            /*
            0-------*
            |       |
            |       |
            *-------*
            */
            x = CalcX(unext, v);
            y = CalcY(unext, v);
            z = CalcZ(unext, v);
            vertexList.push( x, y, z );

            textCoords.push(u / uend, v / vend);
            textCoords.push(unext / uend, v / vend);
        }
    }

    return [vertexList, textCoords];
}

function CreateSphereData() {
    let vertexList = [];
    let textCoords = [];

    let thetaStep = Math.PI / 10.0
    let phiStep = Math.PI / 10.0

    for(let theta = 0.0; theta < Math.PI; theta = theta + thetaStep)
    {
        let sinTheta = Math.sin(theta)
        let cosTheta = Math.cos(theta)

        let thetaNext = theta + thetaStep
        let sinThetaNext = Math.sin(thetaNext)
        let cosThetaNext = Math.cos(thetaNext)

        for(let phi = 0.0; phi < 2.0 * Math.PI; phi = phi + phiStep)
        {
            let sinPhi = Math.sin(phi)
            let cosPhi = Math.cos(phi)

            let x = sphereRadius * cosPhi * sinTheta
            let y = sphereRadius * sinPhi * sinTheta
            let z = sphereRadius * cosTheta
  
            vertexList.push(x, y, z)
            textCoords.push(1, 1);

            x = sphereRadius * cosPhi * sinThetaNext
            y = sphereRadius * sinPhi * sinThetaNext
            z = sphereRadius * cosThetaNext

            vertexList.push(x, y, z)
            textCoords.push(1, 1);
        }
    }

    return [vertexList, textCoords];
}

function CalcX(u, v)
{
    let uRad =  deg2rad(u);
    let vRad = deg2rad(v);

    return vRad * Math.cos(uRad);
}

function CalcY(u, v)
{
    let uRad =  deg2rad(u);
    let vRad = deg2rad(v);

    return vRad * Math.sin(uRad);
}

function CalcZ(u, v)
{
    let a = 1;
    let b = 1;
    let c = 1;

    let uRad =  deg2rad(u);
    let vRad = deg2rad(v);

    return c * Math.sqrt(a * a - (b * b * Math.cos(uRad) * Math.cos(uRad)));
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iTextureCoords             = gl.getAttribLocation(prog, "texcoord");
    
    shProgram.iColor                     = gl.getUniformLocation(prog, "color");

    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    
    shProgram.iTexture                   = gl.getUniformLocation(prog, "u_texture");

    surface = new Model('Surface');
    let SurfaceData = CreateSurfaceData();
    surface.BufferData(SurfaceData[0], SurfaceData[1]);

    AudioSphere = new Model('Sphere');
    let SphereData = CreateSphereData()
    AudioSphere.BufferData(SphereData[0], SphereData[1]);

    BackgroundVideoModel = new Model();
    let BackgroundData = CreateBackgroundData();
    BackgroundVideoModel.BufferData(BackgroundData[0], BackgroundData[1]);
}


/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}

/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    // Canvas
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");

        CanvasWidth = canvas.scrollWidth;
        CanvasHeight = canvas.scrollHeight;

        gl = canvas.getContext("webgl");
        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }

    // GL
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    video = document.createElement('video');
    video.setAttribute('autoplay', true);
    window.vid = video;
        
    navigator.getUserMedia({ video: true, audio: false }, function (stream) {
        video.srcObject = stream;
    }, function (e) {
        console.error('Rejected!', e);
    });

    SetUpWebCamTexture()

    spaceball = new TrackballRotator(canvas, draw, 0)
    LoadTexture()
  
    playVideo()
    setupAudio()
}

function playVideo(){
    draw();
    setInterval(playVideo, 1/24);
}

function setupAudio() {
    audioSource = document.getElementById('audio')
  
    audioSource.addEventListener('play', () => {
      if (!sound.audioCtx) {
        sound.audioCtx = new window.AudioContext()
        sound.source = sound.audioCtx.createMediaElementSource(audioSource)
        sound.panner = sound.audioCtx.createPanner()
        sound.filter = sound.audioCtx.createBiquadFilter()
  
        // Filter settings
        sound.filter.type = 'bandpass'
        sound.filter.detune.value = 10
        sound.filter.frequency.value = 700
  
        // Connecting nodes
        sound.source.connect(sound.panner)
        sound.panner.connect(sound.audioCtx.destination)
      }
      sound.audioCtx.resume()
    })
  
    audioSource.addEventListener('pause', () => {
      if (sound.audioCtx) {
        sound.audioCtx.suspend()
      }
    })

    let filterCheck = document.getElementById('filterCheck')
    filterCheck.addEventListener('change', () => {
        if (filterCheck.checked) 
        {
            sound.panner.disconnect()
            sound.panner.connect(sound.filter)
            sound.filter.connect(sound.audioCtx.destination)
        } 
        else 
        {
            sound.panner.disconnect()
            sound.panner.connect(sound.audioCtx.destination)
        }
    })
  }

const dataContainerOrientation = document.getElementById('dataContainerOrientation');

if(window.DeviceOrientationEvent) 
{
    dataContainerOrientation.innerHTML = 'alpha: ' + SensorAlpha + '  beta: ' + SensorBeta + '  gamma: ' + SensorGamma;

    window.addEventListener('deviceorientation', function (event) {  
        SensorAlpha = event.alpha;
        SensorBeta = event.beta;
        SensorGamma = event.gamma;
    
        if(SensorAlpha!=null || SensorBeta!=null || SensorGamma!=null) 
        {
            dataContainerOrientation.innerHTML = 'alpha: ' + SensorAlpha + '  beta: ' + SensorBeta + '  gamma: ' + SensorGamma;
        }
      
        draw();
    });
}

function LoadTexture()
{
    SurfaceTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, SurfaceTexture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
 
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
              new Uint8Array([0, 0, 255, 255]));
 
    var image = new Image();
    image.crossOrigin = "anonymous"
    image.src = "https://i1.photo.2gis.com/images/profile/30258560049997155_fe3f.jpg";
    //image.src = "https://images.pexels.com/photos/3490253/pexels-photo-3490253.jpeg?cs=srgb&dl=pexels-ivy-son-3490253.jpg&fm=jpg";
    image.addEventListener('load', function() {
        gl.bindTexture(gl.TEXTURE_2D, SurfaceTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,gl.UNSIGNED_BYTE, image);
        draw();
    });
}

function SetUpWebCamTexture()
{
    TextureWebCam = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, TextureWebCam);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

function getRotationMatrix( alpha, beta, gamma ) {

    var degtorad = Math.PI / 180; // Degree-to-Radian conversion

    var _x = beta  ? beta  * degtorad : 0; // beta value
    var _y = gamma ? gamma * degtorad : 0; // gamma value
    var _z = alpha ? alpha * degtorad : 0; // alpha value

    var cX = Math.cos( _x );
    var cY = Math.cos( _y );
    var cZ = Math.cos( _z );
    var sX = Math.sin( _x );
    var sY = Math.sin( _y );
    var sZ = Math.sin( _z );

    //
    // ZXY rotation matrix construction.
    //

    var m11 = cZ * cY - sZ * sX * sY;
    var m12 = - cX * sZ;
    var m13 = cY * sZ * sX + cZ * sY;

    var m21 = cY * sZ + cZ * sX * sY;
    var m22 = cZ * cX;
    var m23 = sZ * sY - cZ * cY * sX;

    var m31 = - cX * sY;
    var m32 = sX;
    var m33 = cX * cY;

    let dst = new Float32Array(16);

    dst[0] = m11;
    dst[1] = m12;
    dst[2] = m13;
    dst[3] = 0.0;
    dst[4] = m21;
    dst[5] = m22;
    dst[6] = m23;
    dst[7] = 0.0;
    dst[8] = m31;
    dst[9] = m32;
    dst[10] = m33;
    dst[11] = 0.0;
    dst[12] = 0.0;
    dst[13] = 0.0;
    dst[14] = 0.0;
    dst[15] = 1.0;

    return dst;
}

function multiplyMatrixAndPoint(matrix, point) {
    // Give a simple variable name to each part of the matrix, a column and row number
    let c0r0 = matrix[0],
      c1r0 = matrix[1],
      c2r0 = matrix[2],
      c3r0 = matrix[3];
    let c0r1 = matrix[4],
      c1r1 = matrix[5],
      c2r1 = matrix[6],
      c3r1 = matrix[7];
    let c0r2 = matrix[8],
      c1r2 = matrix[9],
      c2r2 = matrix[10],
      c3r2 = matrix[11];
    let c0r3 = matrix[12],
      c1r3 = matrix[13],
      c2r3 = matrix[14],
      c3r3 = matrix[15];
  
    // Now set some simple names for the point
    let x = point[0];
    let y = point[1];
    let z = point[2];
    let w = point[3];
  
    // Multiply the point against each part of the 1st column, then add together
    let resultX = x * c0r0 + y * c0r1 + z * c0r2 + w * c0r3;
  
    // Multiply the point against each part of the 2nd column, then add together
    let resultY = x * c1r0 + y * c1r1 + z * c1r2 + w * c1r3;
  
    // Multiply the point against each part of the 3rd column, then add together
    let resultZ = x * c2r0 + y * c2r1 + z * c2r2 + w * c2r3;
  
    // Multiply the point against each part of the 4th column, then add together
    let resultW = x * c3r0 + y * c3r1 + z * c3r2 + w * c3r3;
  
    return [resultX, resultY, resultZ, resultW];
  }