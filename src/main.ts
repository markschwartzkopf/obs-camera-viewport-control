import obsWebsocketJs from 'obs-websocket-js';
import { icons } from './icons';

const obs = new obsWebsocketJs();
let connectedToOBS = false;
let obsConnectionError = '';
let inMove = false;
let lastMouseEvent: MouseEvent | null = null;

let selectedScene: string | null = null;
let selectedSceneItems: ObsSceneItem[] | null = null;
let referenceIndex: number | null = null;
let cameraIndex: number | null = null;

if (localStorage.getItem('selectedScene'))
	selectedScene = localStorage.getItem('selectedScene')!;
if (localStorage.getItem('referenceIndex') !== null)
	referenceIndex = parseInt(localStorage.getItem('referenceIndex')!);
if (localStorage.getItem('cameraIndex') !== null)
	cameraIndex = parseInt(localStorage.getItem('cameraIndex')!);

let obsPort = 4455;
let obsPassword = '';

if (localStorage.getItem('obsPort'))
	obsPort = parseInt(localStorage.getItem('obsPort')!);
if (localStorage.getItem('obsPassword'))
	obsPassword = localStorage.getItem('obsPassword')!;

const ball = document.getElementById('ball') as HTMLDivElement;
const handle = document.getElementById('handle') as HTMLDivElement;
const stick = document.getElementById('stick') as HTMLDivElement;
const upArrow = document.getElementById('up') as HTMLDivElement;
const downArrow = document.getElementById('down') as HTMLDivElement;
const leftArrow = document.getElementById('left') as HTMLDivElement;
const rightArrow = document.getElementById('right') as HTMLDivElement;
const plusZoom = document.getElementById('+') as HTMLDivElement;
const minusZoom = document.getElementById('-') as HTMLDivElement;

upArrow.onclick = () => {
	pan({ x: 0, y: -1, zoom: 0 });
};
downArrow.onclick = () => {
	pan({ x: 0, y: 1, zoom: 0 });
};
leftArrow.onclick = () => {
	pan({ x: -1, y: 0, zoom: 0 });
};
rightArrow.onclick = () => {
	pan({ x: 1, y: 0, zoom: 0 });
};
plusZoom.onclick = () => {
	pan({ x: 0, y: 0, zoom: 1 });
};
minusZoom.onclick = () => {
	pan({ x: 0, y: 0, zoom: -1 });
};

let clickLoc = { x: 0, y: 0 };
let joystickMove = false;
let handleMove = false;

ball.onmousedown = (e) => {
	if (e.button === 0) {
		clickLoc = { x: e.clientX, y: e.clientY };
		joystickMove = true;
	}
};
handle.onmousedown = (e) => {
	if (e.button === 0) {
		clickLoc = { x: e.clientX, y: e.clientY };
		handleMove = true;
	}
};

const controlsMove = (newE?: MouseEvent) => {
	const e = newE ? newE : lastMouseEvent;
	if (!e) return;
	lastMouseEvent = e;
	if (e.buttons % 2) {
		if (joystickMove) {
			const diff = {
				x: (e.clientX - clickLoc.x) / 2,
				y: (e.clientY - clickLoc.y) / 2,
			};
			if (diff.x > 50) {
				diff.x = 50;
				clickLoc.x = e.clientX - 100;
			}
			if (diff.x < -50) {
				diff.x = -50;
				clickLoc.x = e.clientX + 100;
			}
			if (diff.y > 50) {
				diff.y = 50;
				clickLoc.y = e.clientY - 100;
			}
			if (diff.y < -50) {
				diff.y = -50;
				clickLoc.y = e.clientY + 100;
			}
			const angle = Math.atan2(diff.y, diff.x);
			pan({ ...diff, zoom: 0 });
			diff.x -= 50;
			diff.y -= 50;
			stick.style.transform =
				'translate(calc(var(--joystick-width) * 5 / 12), -50%) rotate(' +
				angle +
				'rad)';
			ball.style.transform = 'translate(' + diff.x + '%, ' + diff.y + '%)';
		}
		if (handleMove) {
			let diff = (clickLoc.y - e.clientY) / 2;
			if (diff > 50) {
				diff = 50;
			}
			if (diff < -50) {
				diff = -50;
			}
			pan({ x: 0, y: 0, zoom: diff });
			diff *= -2.6;
			diff -= 50;
			handle.style.transform = 'translate(-50%, ' + diff + '%)';
		}
	} else if (joystickMove || handleMove) controlsStop();
};

const controlsStop = () => {
	lastMouseEvent = null;
	ball.style.transform = 'translate(-50%, -50%)';
	handle.style.transform = 'translate(-50%, -50%)';
	joystickMove = false;
	handleMove = false;
};

document.onmousemove = controlsMove;
document.onmouseup = controlsMove;

function prepTransform(
	transform: SubTransform,
	reference: ObsSceneItemTransform
): SendTransform {
	const rtn: SendTransform = {
		positionX: reference.positionX,
		positionY: reference.positionY,
		cropLeft: transform.cropLeft >= 0 ? transform.cropLeft : 0,
		cropRight: transform.cropRight >= 0 ? transform.cropRight : 0,
		cropTop: transform.cropTop >= 0 ? transform.cropTop : 0,
		cropBottom: transform.cropBottom >= 0 ? transform.cropBottom : 0,
		scaleX: 1,
		scaleY: 1,
		alignment: 0,
		rotation: 0,
		boundsType: 'OBS_BOUNDS_NONE',
		boundsAlignment: 0,
	};
	const align = reference.alignment;
	if (align === 5 || align === 1 || align === 9)
		rtn.positionX += reference.width / 2;
	if (align === 6 || align === 2 || align === 10)
		rtn.positionX -= reference.width / 2;
	if (align === 5 || align === 4 || align === 6)
		rtn.positionY += reference.height / 2;
	if (align === 9 || align === 8 || align === 10)
		rtn.positionY -= reference.height / 2;
	const cropOverWide = transform.sourceWidth - rtn.cropLeft - rtn.cropRight - 3;
	if (cropOverWide < 0) {
		rtn.cropLeft += cropOverWide / 2;
		rtn.cropRight += cropOverWide / 2;
	}
	const cropOverTall =
		transform.sourceHeight - rtn.cropTop - rtn.cropBottom - 3;
	if (cropOverTall < 0) {
		rtn.cropTop += cropOverTall / 2;
		rtn.cropBottom += cropOverTall / 2;
	}
	if (rtn.cropTop < 0) rtn.cropTop = 0;
	if (rtn.cropBottom < 0) rtn.cropBottom = 0;
	if (rtn.cropLeft < 0) rtn.cropLeft = 0;
	if (rtn.cropRight < 0) rtn.cropRight = 0;
	const oldWidth = transform.sourceWidth - rtn.cropLeft - rtn.cropRight;
	const oldHeight = transform.sourceHeight - rtn.cropTop - rtn.cropBottom;
	const wideShrink =
		(oldHeight * reference.width) / (oldWidth * reference.height);
	let newWidth = oldWidth;
	if (wideShrink < 1) {
		newWidth = oldWidth * wideShrink;
		const diff = oldWidth - newWidth;
		rtn.cropLeft += diff / 2;
		rtn.cropRight += diff / 2;
	} else {
		const newHeight = oldHeight / wideShrink;
		const diff = oldHeight - newHeight;
		rtn.cropBottom += diff / 2;
		rtn.cropTop += diff / 2;
	}
	rtn.scaleX = reference.width / newWidth;
	if (rtn.scaleX > 50) rtn.scaleX = 50;
	rtn.scaleY = rtn.scaleX;
	return rtn;
}

function pan(dir: { x: number; y: number; zoom: number }) {
	if (inMove) {
		console.log('skip');
		return;
	}
	inMove = true;
	if (
		connectedToOBS &&
		selectedScene &&
		selectedSceneItems &&
		cameraIndex !== null &&
		referenceIndex !== null
	) {
		const selectedSceneStr = selectedScene;
		const cameraIndexNum = cameraIndex;
		const referenceIndexNum = referenceIndex;
		const selectedSceneItemsArr = selectedSceneItems;
		obs
			.call('GetSceneItemTransform', {
				sceneName: selectedScene,
				sceneItemId: selectedSceneItems[cameraIndex].sceneItemId,
			})
			.then((data) => {
				const transform = data.sceneItemTransform;
				if (IsObsSceneItemTransform(transform)) {
					selectedSceneItemsArr[cameraIndexNum].sceneItemTransform = transform;
				} else
					showError(
						'Bad format of scene item transform from obs-websocket API'
					);
				return obs.call('GetSceneItemTransform', {
					sceneName: selectedSceneStr,
					sceneItemId: selectedSceneItemsArr[referenceIndexNum].sceneItemId,
				});
			})
			.then((data) => {
				const transform = data.sceneItemTransform;
				if (IsObsSceneItemTransform(transform)) {
					selectedSceneItemsArr[referenceIndexNum].sceneItemTransform =
						transform;
				}
				const cam = selectedSceneItemsArr[cameraIndexNum].sceneItemTransform;
				const ref = selectedSceneItemsArr[referenceIndexNum].sceneItemTransform;
				const smallestInc = 1 / (cam.scaleX * 2);

				let cropLeftDelta = dir.x * smallestInc;
				let cropRightDelta = dir.x * smallestInc * -1;
				let cropTopDelta = dir.y * smallestInc;
				let cropBottomDelta = dir.y * smallestInc * -1;
				let zoomDelta = dir.zoom * (smallestInc / 2)

				if (
					Math.abs(Math.min(
						cropLeftDelta,
						cropRightDelta,
						cropTopDelta,
						cropBottomDelta
					)) < 1
				) {
					if (dir.x !== 0 || dir.y !==0) {
						if (Math.abs(dir.x) > Math.abs(dir.y)) {
							cropLeftDelta = cropLeftDelta > 0 ? 1 : -1;
							cropRightDelta = cropRightDelta > 0 ? 1 : -1;
							console.log('lr')
						} else {
							cropTopDelta = cropTopDelta > 0 ? 1 : -1;
							cropBottomDelta = cropBottomDelta > 0 ? 1 : -1;
							console.log('tb')
						}
					}
				}
				if (Math.abs(zoomDelta) < 1) zoomDelta = zoomDelta > 0 ? 1 : -1

				console.log(`${cropLeftDelta} ${cropRightDelta} ${cropTopDelta} ${cropBottomDelta}`)

				const newTransform: SubTransform = {
					cropLeft:
						cam.cropLeft + cropLeftDelta + zoomDelta,
					cropRight:
						cam.cropRight + cropRightDelta + zoomDelta,
					cropTop:
						cam.cropTop + cropTopDelta + zoomDelta,
					cropBottom:
						cam.cropBottom + cropBottomDelta + zoomDelta,
					sourceWidth: cam.sourceWidth,
					sourceHeight: cam.sourceHeight,
				};
				console.log(newTransform);
				console.log(prepTransform(newTransform, ref));
				return obs.call('SetSceneItemTransform', {
					sceneName: selectedSceneStr,
					sceneItemId: selectedSceneItemsArr[cameraIndexNum].sceneItemId,
					sceneItemTransform: prepTransform(newTransform, ref),
				});
			})
			.catch(showError)
			.finally(() => {
				setTimeout(() => {
					inMove = false;
					controlsMove();
				}, 30);
			});
	}
}

function showError(err: any) {
	document.getElementById('footer')!.innerHTML =
		'ERROR: ' + JSON.stringify(err);
	document.getElementById('footer')!.onclick = refreshFooter;
	console.error(err);
}
function hideWarning() {
	document.getElementById('warning')!.classList.add('hide');
}
function showWarning(msg: string) {
	document.getElementById('warning-msg')!.innerHTML = msg;
	document.getElementById('warning')!.classList.remove('hide');
}

function connectToOBS() {
	obsConnectionError = '';
	showWarning('Connecting dashboard to OBS');
	obs
		.connect(`ws://127.0.0.1:${obsPort}`, obsPassword)
		.then(() => {
			connectedToOBS = true;
			hideWarning();
			if (selectedScene) {
				obs
					.call('GetSceneList')
					.then((list) => {
						let scenes: string[] = [];
						if (isObsSceneList(list)) {
							scenes = list.scenes.map((x) => x.sceneName);
						}
						if (selectedScene && scenes.indexOf(selectedScene) > -1) {
							obs
								.call('GetSceneItemList', { sceneName: selectedScene })
								.then((data) => {
									const items = data.sceneItems;
									if (isObsSceneItemArray(items)) {
										selectedSceneItems = items;
										updateMainDiv();
									} else showError(`Couldn't fetch scene items from OBS`);
								})
								.catch(showError);
						} else {
							selectedScene = null;
							localStorage.removeItem('selectedScene');
						}
					})
					.catch(showError);
			} else updateMainDiv();
		})
		.catch((err) => {
			if (err?.error) err = err.error;
			obsConnectionError = err;
			showWarning('Connection error: ' + err);
			refreshFooter();
		});
}
connectToOBS();
refreshFooter();
const screens = [
	'scene-select',
	'reference-select',
	'camera-select',
	'camera-controls',
] as const;

function hideAllBut(selectedScreen: (typeof screens)[number]) {
	for (let i = 0; i < screens.length; i++) {
		const screen = document.getElementById(screens[i]) as HTMLDivElement;
		if (screens[i] === selectedScreen) {
			screen.classList.remove('hide');
		} else screen.classList.add('hide');
	}
}

function updateMainDiv() {
	if (selectedScene === null) {
		showSceneList();
	} else if (referenceIndex === null) {
		showItemSelect('reference-select');
	} else if (cameraIndex === null) {
		showItemSelect('camera-select');
	} else showControls();
}

function showSceneList() {
	selectedScene = null;
	selectedSceneItems = null;
	obs
		.call('GetSceneList')
		.then((list) => {
			if (isObsSceneList(list)) {
				hideAllBut('scene-select');
				const scenelist = list.scenes
					.sort((a, b) => b.sceneIndex - a.sceneIndex)
					.map((x) => x.sceneName);
				const scenesDiv = document.getElementById('scenes') as HTMLDivElement;
				scenesDiv.innerHTML = '';
				for (let i = 0; i < scenelist.length; i++) {
					const sourceDiv = document.createElement('div');
					sourceDiv.classList.add('source');
					sourceDiv.onclick = () => {
						selectedScene = scenelist[i];
						localStorage.setItem('selectedScene', selectedScene);
						obs
							.call('GetSceneItemList', { sceneName: selectedScene })
							.then((list) => {
								const items = list.sceneItems;
								if (isObsSceneItemArray(items)) {
									selectedSceneItems = items;
									updateMainDiv();
								}
							})
							.catch(showError);
					};
					const text = document.createElement('div');
					text.classList.add('source-text');
					text.innerHTML += scenelist[i];
					sourceDiv.appendChild(text);
					scenesDiv.appendChild(sourceDiv);
				}
			}
		})
		.catch(showError);
}

function showItemSelect(screen: 'reference-select' | 'camera-select') {
	hideAllBut(screen);
	if (selectedSceneItems) {
		const itemsDiv = document.getElementById(
			screen === 'reference-select' ? 'reference-items' : 'camera-items'
		) as HTMLDivElement;
		itemsDiv.innerHTML = '';
		for (let i = 0; i < selectedSceneItems.length; i++) {
			const sourceDiv = document.createElement('div');
			sourceDiv.classList.add('source');
			const typeIcon = document.createElement('img');
			typeIcon.classList.add('icon');
			const kind = selectedSceneItems[i].inputKind
				? (selectedSceneItems[i].inputKind as ObsInputKind)
				: selectedSceneItems[i].isGroup
				? 'group'
				: 'scene';
			if (
				icons.sources.hasOwnProperty(kind) &&
				icons.sources[kind as SceneItemKind]
			) {
				typeIcon.src = icons.sources[kind as SceneItemKind];
			} else typeIcon.src = icons.defaultSource;
			sourceDiv.appendChild(typeIcon);
			sourceDiv.onclick = () => {
				if (screen === 'reference-select') {
					referenceIndex = i;
					localStorage.setItem('referenceIndex', referenceIndex.toString());
				} else {
					cameraIndex = i;
					localStorage.setItem('cameraIndex', cameraIndex.toString());
				}
				updateMainDiv();
			};
			const text = document.createElement('div');
			text.classList.add('source-text');
			text.innerHTML += selectedSceneItems[i].sourceName;
			sourceDiv.appendChild(text);
			itemsDiv.appendChild(sourceDiv);
		}
	}
}

function showControls() {
	hideAllBut('camera-controls');
}

obs.on('ConnectionClosed', () => {
	if (!obsConnectionError) showWarning('OBS connection closed.');
	connectedToOBS = false;
	refreshFooter();
});

function refreshFooter() {
	const footer = document.getElementById('footer')!;
	footer.innerHTML = '';
	footer.onclick = null;
	let button = document.createElement('div');
	button.classList.add('icon', 'footer');
	let icon = document.createElement('img');
	icon.width = 16;
	icon.classList.add('icon', 'footer');
	icon.src = icons.revert;
	button.onclick = () => {
		if (selectedScene === null) {
			connectToOBS();
		} else if (referenceIndex === null) {
			selectedScene = null;
			localStorage.removeItem('selectedScene');
			updateMainDiv();
		} else if (cameraIndex === null) {
			referenceIndex = null;
			localStorage.removeItem('referenceIndex');
			updateMainDiv();
		} else {
			cameraIndex = null;
			localStorage.removeItem('cameraIndex');
			updateMainDiv();
		}
	};
	button.appendChild(icon);
	footer.appendChild(button);
	button = document.createElement('div');
	button.classList.add('icon', 'footer');
	icon = document.createElement('img');
	icon.width = 16;
	icon.classList.add('icon', 'footer');
	icon.src = `data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20viewBox%3D%270%200%2032%2032%27%3E%3Cpath%20fill%3D%27%23d2d2d2%27%20fill-rule%3D%27evenodd%27%20d%3D%27M32%2017.77V14.1l-4.434-1.468-1.027-2.497%202.008-4.21-2.582-2.592-4.137%202.085-2.492-1.033-1.574-4.4h-3.66L12.664%204.43l-2.539%201.03-4.203-2.01-2.586%202.583%202.082%204.152-1.031%202.497L0%2014.234v3.647l4.434%201.468%201.027%202.497-2.008%204.216%202.582%202.59%204.137-2.09%202.492%201.035%201.574%204.394h3.637l1.437-4.444%202.54-1.029%204.207%202.018%202.582-2.59-2.102-4.15%201.074-2.496L32%2017.72zm-16%205.105c-3.793%200-6.856-3.07-6.856-6.873S12.208%209.128%2016%209.128s6.856%203.07%206.856%206.874-3.063%206.873-6.856%206.873z%27%2F%3E%3C%2Fsvg%3E`;
	button.onclick = () => {
		setTimeout(() => {
			if (document.querySelectorAll('.pop-up').length == 0) {
				const settingsBox = document.createElement('div');
				settingsBox.classList.add('pop-up');
				settingsBox.style.top = 'unset';
				settingsBox.style.bottom = '25px';
				settingsBox.style.zIndex = '9999';
				const portDiv = document.createElement('div');
				portDiv.className = 'setup-item';
				portDiv.innerHTML = 'Port: ';
				const port = document.createElement('input');
				port.style.float = 'right';
				port.value = obsPort.toString();
				port.oninput = () => {
					const maybe = parseInt(port.value);
					if (maybe.toString() == port.value) {
						obsPort = maybe;
					} else port.value = obsPort.toString();
				};
				portDiv.appendChild(port);
				settingsBox.appendChild(portDiv);
				const pwdDiv = document.createElement('div');
				pwdDiv.className = 'setup-item';
				pwdDiv.innerHTML = 'Password: ';
				const pwd = document.createElement('input');
				pwd.value = obsPassword;
				pwd.type = 'password';
				pwd.oninput = () => {
					obsPassword = pwd.value;
				};
				pwdDiv.appendChild(pwd);
				settingsBox.appendChild(pwdDiv);
				document.onclick = (e) => {
					if (
						e.target !== settingsBox &&
						!settingsBox.contains(e.target as Node)
					) {
						document.onclick = null;
						localStorage.setItem('obsPort', obsPort.toString());
						localStorage.setItem('obsPassword', obsPassword);
						footer.removeChild(settingsBox);
					}
				};
				footer.appendChild(settingsBox);
			}
		}, 1);
	};
	button.appendChild(icon);
	footer.appendChild(button);
}

//Type Checking:

function isObsSceneListScene(test: any): test is ObsSceneListScene {
	return (
		typeof test === 'object' &&
		typeof test.sceneIndex === 'number' &&
		typeof test.sceneName === 'string'
	);
}

function isObsSceneList(test: any): test is ObsSceneList {
	if (
		typeof test !== 'object' ||
		!(
			typeof test.currentPreviewSceneName === 'string' ||
			test.currentPreviewSceneName === null
		) ||
		typeof test.currentProgramSceneName !== 'string' ||
		!Array.isArray(test.scenes)
	)
		return false;
	let rtn = true;
	for (let i = 0; i < test.scenes.length; i++) {
		if (!isObsSceneListScene(test.scenes[i])) rtn = false;
	}
	return rtn;
}

function isObsSceneItemArray(test: any): test is ObsSceneItem[] {
	if (!Array.isArray(test)) return false;
	return !test.find((x) => {
		return !isObsSceneItem(x);
	});
}

function isObsSceneItem(test: any): test is ObsSceneItem {
	if (typeof test !== 'object') return false;
	if (test === null) return false;
	return (
		((isObsInputKind(test.inputKind) &&
			test.isGroup === null &&
			test.sourceType === 'OBS_SOURCE_TYPE_INPUT') ||
			(test.inputKind === null &&
				typeof test.isGroup === 'boolean' &&
				test.sourceType === 'OBS_SOURCE_TYPE_SCENE')) &&
		isObsBlendMode(test.sceneItemBlendMode) &&
		typeof test.sceneItemEnabled === 'boolean' &&
		typeof test.sceneItemId === 'number' &&
		typeof test.sceneItemIndex === 'number' &&
		typeof test.sceneItemLocked === 'boolean' &&
		IsObsSceneItemTransform(test.sceneItemTransform) &&
		typeof test.sourceName === 'string'
	);
}

function isObsInputKind(test: any): test is ObsInputKind {
	if (typeof test !== 'string') return false;
	const ObsSourceTypes: ObsInputKind[] = [
		'decklink-input',
		'wasapi_input_capture',
		'wasapi_output_capture',
		'browser_source',
		'color_source_v3',
		'monitor_capture',
		'game_capture',
		'image_source',
		'slideshow',
		'ffmpeg_source',
		'ndi_source',
		'text_gdiplus_v2',
		'dshow_input',
		'window_capture',
		'text_ft2_source_v2',
	];
	return (ObsSourceTypes as string[]).indexOf(test) != -1;
}

function isObsBlendMode(test: any): test is ObsBlendMode {
	if (typeof test !== 'string') return false;
	const ObsBlendModes: ObsBlendMode[] = [
		'OBS_BLEND_NORMAL',
		'OBS_BLEND_ADDITIVE',
		'OBS_BLEND_SUBTRACT',
		'OBS_BLEND_SCREEN',
		'OBS_BLEND_MULTIPLY',
		'OBS_BLEND_LIGHTEN',
		'OBS_BLEND_DARKEN',
	];
	return (ObsBlendModes as string[]).indexOf(test) != -1;
}

function IsObsSceneItemTransform(test: any): test is ObsSceneItemTransform {
	if (typeof test !== 'object') return false;
	if (test === null) return false;
	return (
		typeof test.positionX === 'number' &&
		typeof test.positionY === 'number' &&
		isObsAlignment(test.alignment) &&
		typeof test.rotation === 'number' &&
		typeof test.scaleX === 'number' &&
		typeof test.scaleY === 'number' &&
		typeof test.cropTop === 'number' &&
		typeof test.cropRight === 'number' &&
		typeof test.cropBottom === 'number' &&
		typeof test.cropLeft === 'number' &&
		isObsBoundsType(test.boundsType) &&
		isObsAlignment(test.boundsAlignment) &&
		typeof test.boundsWidth === 'number' &&
		typeof test.boundsHeight === 'number' &&
		typeof test.sourceWidth === 'number' &&
		typeof test.sourceHeight === 'number' &&
		typeof test.width === 'number' &&
		typeof test.height === 'number'
	);
}

function isObsAlignment(test: any): test is ObsAlignment {
	if (typeof test !== 'number') return false;
	const ObsAlignments: ObsAlignment[] = [5, 4, 6, 1, 0, 2, 9, 8, 10];
	return (ObsAlignments as number[]).indexOf(test) != -1;
}

function isObsBoundsType(test: any): test is ObsBoundsType {
	if (typeof test !== 'string') return false;
	const ObsBoundsTypes: ObsBoundsType[] = [
		'OBS_BOUNDS_STRETCH',
		'OBS_BOUNDS_SCALE_INNER',
		'OBS_BOUNDS_SCALE_OUTER',
		'OBS_BOUNDS_SCALE_TO_WIDTH',
		'OBS_BOUNDS_SCALE_TO_HEIGHT',
		'OBS_BOUNDS_MAX_ONLY',
		'OBS_BOUNDS_NONE',
	];
	return (ObsBoundsTypes as string[]).indexOf(test) != -1;
}
