import React, { useState, useEffect } from 'react';
import { connect } from 'react-redux';
import { updateScreen } from 'store/slices/UI';

const WindowDimensions = ({ updateScreen }) => {
  useEffect(() => {
    const handleResize = () => {
      updateScreen({
        width: window.innerWidth,
        height: window.innerHeight,
        left: window.screenX || window.screenLeft,
        top: window.screenY || window.screenTop,
      });
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize);
    const handle = setTimeout(handleResize, 1000);

    return () => {
      clearTimeout(handle);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize);
    };
  }, []);

  return null;
};

export default connect(
  null,
  { updateScreen }
)(WindowDimensions);