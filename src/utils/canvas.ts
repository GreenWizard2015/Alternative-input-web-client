export function enableFullscreen(canvas) {
  if (canvas.requestFullscreen) {
    canvas.requestFullscreen();
  } else if (canvas.mozRequestFullScreen) { /* Firefox */
    canvas.mozRequestFullScreen();
  } else if (canvas.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
    canvas.webkitRequestFullscreen();
  } else if (canvas.msRequestFullscreen) { /* IE/Edge */
    canvas.msRequestFullscreen();
  }
}

export function disableFullscreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document['mozCancelFullScreen']) { /* Firefox */
    document['mozCancelFullScreen']();
  } else if (document['webkitExitFullscreen']) { /* Chrome, Safari and Opera */
    document['webkitExitFullscreen']();
  } else if (document['msExitFullscree']) { /* IE/Edge */
    document['msExitFullscreen']();
  }
}

export function toggleFullscreen(canvas: HTMLCanvasElement, isFullscreen?: boolean) {
  const trueIsFullscreen = isFullscreen ?? document.fullscreenElement !== canvas;

  if (isFullscreen) {
    enableFullscreen(canvas);
  } else {
    disableFullscreen();
  }
}