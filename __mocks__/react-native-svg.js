const React = require('react');
const { View } = require('react-native');

const stub = ({ children, ...props }) => React.createElement(View, props, children);
const stubLeaf = () => null;

module.exports = {
  default: stub,
  Svg: stub,
  Circle: stubLeaf,
  Ellipse: stubLeaf,
  G: stub,
  Text: stubLeaf,
  TSpan: stubLeaf,
  TextPath: stubLeaf,
  Path: stubLeaf,
  Polygon: stubLeaf,
  Polyline: stubLeaf,
  Line: stubLeaf,
  Rect: stubLeaf,
  Use: stubLeaf,
  Image: stubLeaf,
  Symbol: stubLeaf,
  Defs: stubLeaf,
  LinearGradient: stub,
  RadialGradient: stub,
  Stop: stubLeaf,
  ClipPath: stub,
  Pattern: stub,
  Mask: stub,
};
