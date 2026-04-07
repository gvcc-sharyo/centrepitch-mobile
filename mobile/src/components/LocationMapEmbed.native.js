import React from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

export default function LocationMapEmbed({ region, marker, onPressMap, onMarkerDragEnd }) {
  const mapKey = `${region?.latitude}-${region?.longitude}-${region?.latitudeDelta}`;
  return (
    <View style={styles.wrap}>
      <MapView
        key={mapKey}
        style={styles.map}
        initialRegion={region}
        onPress={onPressMap}
        showsUserLocation
      >
        <Marker
          coordinate={marker}
          draggable
          onDragEnd={(e) => onMarkerDragEnd?.(e.nativeEvent.coordinate)}
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 220, borderRadius: 16, overflow: "hidden" },
  map: { ...StyleSheet.absoluteFillObject },
});
