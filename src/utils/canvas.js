function enableFullscreen(canvas) {
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

function disableFullscreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.mozCancelFullScreen) { /* Firefox */
    document.mozCancelFullScreen();
  } else if (document.webkitExitFullscreen) { /* Chrome, Safari and Opera */
    document.webkitExitFullscreen();
  } else if (document.msExitFullscreen) { /* IE/Edge */
    document.msExitFullscreen();
  }
}

function toggleFullscreen(canvas, isFullscreen = null) {
  if (isFullscreen === null) {
    // toggle fullscreen mode if isFullscreen is not specified
    isFullscreen = document.fullscreenElement !== canvas;
  }

  if (isFullscreen) {
    enableFullscreen(canvas);
  } else {
    disableFullscreen();
  }
}

// export all functions
export { enableFullscreen, disableFullscreen, toggleFullscreen };