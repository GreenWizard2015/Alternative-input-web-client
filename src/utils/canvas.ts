export function enableFullscreen(canvas: HTMLElement): void {
  const el = canvas as HTMLElement & {
    mozRequestFullScreen?: () => void;
    webkitRequestFullscreen?: () => void;
    msRequestFullscreen?: () => void;
  };
  if (el.requestFullscreen) {
    el.requestFullscreen();
  } else if (el.mozRequestFullScreen) {
    /* Firefox */
    el.mozRequestFullScreen();
  } else if (el.webkitRequestFullscreen) {
    /* Chrome, Safari and Opera */
    el.webkitRequestFullscreen();
  } else if (el.msRequestFullscreen) {
    /* IE/Edge */
    el.msRequestFullscreen();
  }
}

export function disableFullscreen(): void {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document['mozCancelFullScreen']) {
    /* Firefox */
    document['mozCancelFullScreen']();
  } else if (document['webkitExitFullscreen']) {
    /* Chrome, Safari and Opera */
    document['webkitExitFullscreen']();
  } else if (document['msExitFullscree']) {
    /* IE/Edge */
    document['msExitFullscreen']();
  }
}

export function toggleFullscreen(canvas: HTMLElement, isFullscreen?: boolean) {
  const trueIsFullscreen = isFullscreen ?? document.fullscreenElement !== canvas;

  if (trueIsFullscreen) {
    enableFullscreen(canvas);
  } else {
    disableFullscreen();
  }
}
