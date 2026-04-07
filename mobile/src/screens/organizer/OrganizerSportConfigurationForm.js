import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import Feather from "@expo/vector-icons/Feather";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";

import LabeledIconInput from "../../components/forms/LabeledIconInput";
import PrimaryButton from "../../components/forms/PrimaryButton";
import OrganizerScreenShell from "../../components/organizer/OrganizerScreenShell";
import sportService from "../../services/sportService";
import uploadService from "../../services/uploadService";
import { selectUser } from "../../store/slices/authSlice";
import { selectTheme } from "../../store/slices/uiSlice";
import { getErrorMessage } from "../../utils/helpers";
import { toast } from "../../utils/toast";
import {
  FORM_TAB_IDS,
  FORM_TAB_LABELS,
  GENDER_OPTIONS,
  MEMBER_FIELD_OPTIONS,
  SCORING_TYPE_OPTIONS,
  SKILL_LEVEL_OPTIONS,
  cleanFormDataForSubmit,
  createInitialFormData,
  deepClone,
  initialCategoryData,
  mapSportToFormData,
} from "./sports/organizerSportFormState";

function setAtPath(obj, path, value) {
  const keys = path.split(".");
  const next = deepClone(obj);
  let cur = next;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (cur[k] == null || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
  return next;
}

function parseNum(text, fallback) {
  if (text === "" || text == null) return fallback;
  const n = Number(text);
  return Number.isFinite(n) ? n : fallback;
}

export default function OrganizerSportConfigurationForm() {
  const navigation = useNavigation();
  const route = useRoute();
  const theme = useSelector(selectTheme);
  const user = useSelector(selectUser);
  const isDark = theme === "dark";
  const ph = isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";

  const mode = route.params?.mode === "edit" ? "edit" : "create";
  const sportIdParam = route.params?.sportId ? String(route.params.sportId) : "";

  const [formData, setFormData] = useState(() => createInitialFormData());
  const [activeTab, setActiveTab] = useState("basic");
  const [organizerCatalogSports, setOrganizerCatalogSports] = useState([]);
  const [newPosition, setNewPosition] = useState("");
  const [newEquipment, setNewEquipment] = useState({ name: "", isRequired: true, description: "" });
  const [newCategory, setNewCategory] = useState(() => ({ ...initialCategoryData }));
  const [submitting, setSubmitting] = useState(false);
  const [loadingSport, setLoadingSport] = useState(mode === "edit");
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [catalogModal, setCatalogModal] = useState(false);
  const [enumModal, setEnumModal] = useState({ open: false, key: "", options: [], title: "", onPick: () => {} });

  const activeIdx = Math.max(0, FORM_TAB_IDS.indexOf(activeTab));
  const isFirstStep = activeIdx === 0;
  const isLastStep = activeIdx === FORM_TAB_IDS.length - 1;

  const inputClass =
    "mt-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-playfair text-base text-neutral-900 dark:border-white/10 dark:bg-white/5 dark:text-white";

  const setField = useCallback((path, value) => {
    setFormData((prev) => setAtPath(prev, path, value));
  }, []);

  useEffect(() => {
    const raw = user?.organizerSports;
    if (!Array.isArray(raw) || raw.length === 0) {
      setOrganizerCatalogSports([]);
      return;
    }
    const first = raw[0];
    if (first && typeof first === "object" && first.name) {
      setOrganizerCatalogSports(
        raw.map((s) => ({
          _id: s._id,
          name: s.name || "",
          description: s.description || "",
          slug: s.slug || "",
        })),
      );
      return;
    }
    const idSet = new Set(raw.map((x) => String(x?._id || x || "")).filter(Boolean));
    (async () => {
      try {
        const res = await sportService.getSportsList();
        const data = Array.isArray(res?.data) ? res.data : [];
        setOrganizerCatalogSports(data.filter((s) => idSet.has(String(s._id))));
      } catch {
        setOrganizerCatalogSports([]);
      }
    })();
  }, [user?.organizerSports]);

  useEffect(() => {
    if (mode !== "edit" || !sportIdParam) return;
    let cancelled = false;
    (async () => {
      setLoadingSport(true);
      try {
        const res = await sportService.getSportById(sportIdParam);
        const sport = res?.data ?? res;
        if (cancelled || !sport) return;
        setFormData(mapSportToFormData(sport, null));
      } catch (e) {
        toast.error(getErrorMessage(e) || "Could not load sport");
        navigation.goBack();
      } finally {
        if (!cancelled) setLoadingSport(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, sportIdParam, navigation]);

  useEffect(() => {
    if (mode !== "edit" || !formData.name) return;
    const catalogMatch = organizerCatalogSports.find(
      (s) => String(s.name || "").trim().toLowerCase() === String(formData.name || "").trim().toLowerCase(),
    );
    if (!catalogMatch) return;
    setFormData((prev) => {
      if (String(prev.sportId) === String(catalogMatch._id)) return prev;
      return { ...prev, sportId: catalogMatch._id };
    });
  }, [organizerCatalogSports, mode, formData.name]);

  const pickCatalogSport = (row) => {
    setFormData((prev) => ({
      ...prev,
      sportId: row._id || "",
      name: row.name || "",
      description: row.description || "",
    }));
    setCatalogModal(false);
  };

  const toggleFormat = (key) => {
    setFormData((prev) => {
      const n = deepClone(prev);
      n.formats[key].enabled = !n.formats[key].enabled;
      return n;
    });
  };

  const toggleMemberField = (field) => {
    setFormData((prev) => {
      const n = deepClone(prev);
      const arr = n.teamSettings.memberRequiredFields;
      const i = arr.indexOf(field);
      if (i > -1) arr.splice(i, 1);
      else arr.push(field);
      return n;
    });
  };

  const addPosition = () => {
    const t = newPosition.trim();
    if (!t) return;
    setFormData((prev) => {
      const n = deepClone(prev);
      n.teamSettings.positions.push(t);
      return n;
    });
    setNewPosition("");
  };

  const removePosition = (index) => {
    setFormData((prev) => {
      const n = deepClone(prev);
      n.teamSettings.positions.splice(index, 1);
      return n;
    });
  };

  const addEquipment = () => {
    if (!newEquipment.name.trim()) return;
    setFormData((prev) => {
      const n = deepClone(prev);
      n.equipment.push({ ...newEquipment });
      return n;
    });
    setNewEquipment({ name: "", isRequired: true, description: "" });
  };

  const removeEquipment = (index) => {
    setFormData((prev) => {
      const n = deepClone(prev);
      n.equipment.splice(index, 1);
      return n;
    });
  };

  const addCategory = () => {
    if (!newCategory.name?.trim()) {
      toast.error("Enter a category name");
      return;
    }
    setFormData((prev) => {
      const n = deepClone(prev);
      const categoryToAdd = {
        ...newCategory,
        minAge: newCategory.minAge ? Number(newCategory.minAge) : undefined,
        maxAge: newCategory.maxAge ? Number(newCategory.maxAge) : undefined,
        minWeight: newCategory.minWeight ? Number(newCategory.minWeight) : undefined,
        maxWeight: newCategory.maxWeight ? Number(newCategory.maxWeight) : undefined,
        order: n.categories.length,
        isActive: true,
      };
      n.categories.push(categoryToAdd);
      return n;
    });
    setNewCategory({ ...initialCategoryData });
    toast.success("Category added");
  };

  const removeCategory = (index) => {
    setFormData((prev) => {
      const n = deepClone(prev);
      n.categories.splice(index, 1);
      return n;
    });
  };

  const pickIcon = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.error("Photo library permission is required");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setUploadingIcon(true);
    try {
      const asset = result.assets[0];
      const file = { uri: asset.uri, name: "icon.jpg", type: "image/jpeg" };
      const up = await uploadService.uploadSportIconMultipart(file);
      const url = up?.data?.url ?? up?.url;
      if (!url) throw new Error("No URL returned");
      setField("icon", url);
      toast.success("Icon uploaded");
    } catch (e) {
      toast.error(getErrorMessage(e) || "Upload failed");
    } finally {
      setUploadingIcon(false);
    }
  };

  const pickCover = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.error("Photo library permission is required");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setUploadingCover(true);
    try {
      const asset = result.assets[0];
      const file = { uri: asset.uri, name: "cover.jpg", type: "image/jpeg" };
      const up = await uploadService.uploadSportImageMultipart(file);
      const url = up?.data?.url ?? up?.url;
      if (!url) throw new Error("No URL returned");
      setField("image", url);
      toast.success("Cover image uploaded");
    } catch (e) {
      toast.error(getErrorMessage(e) || "Upload failed");
    } finally {
      setUploadingCover(false);
    }
  };

  const validateFormats = () =>
    formData.formats.individual.enabled || formData.formats.doubles.enabled || formData.formats.team.enabled;

  const submit = async () => {
    if (!validateFormats()) {
      toast.error("Enable at least one game format");
      return;
    }
    if (mode === "create" && !String(formData.name || "").trim()) {
      toast.error("Select a catalog sport under Basic (add sports on your organization profile on web if empty)");
      return;
    }
    setSubmitting(true);
    try {
      const cleaned = cleanFormDataForSubmit(deepClone(formData));
      if (mode === "create") {
        await sportService.createPublicSport(cleaned);
        toast.success("Configuration saved");
      } else {
        await sportService.updateOwnPublicSport(sportIdParam, cleaned);
        toast.success("Configuration updated");
      }
      navigation.goBack();
    } catch (e) {
      toast.error(getErrorMessage(e) || "Could not save");
    } finally {
      setSubmitting(false);
    }
  };

  const goNext = () => {
    const i = FORM_TAB_IDS.indexOf(activeTab);
    if (i < FORM_TAB_IDS.length - 1) setActiveTab(FORM_TAB_IDS[i + 1]);
  };

  const goPrev = () => {
    const i = FORM_TAB_IDS.indexOf(activeTab);
    if (i > 0) setActiveTab(FORM_TAB_IDS[i - 1]);
  };

  const tabBar = useMemo(
    () => (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 max-h-12">
        <View className="flex-row flex-wrap gap-2">
          {FORM_TAB_IDS.map((id) => (
            <Pressable
              key={id}
              onPress={() => setActiveTab(id)}
              className={`rounded-full px-3 py-2 ${activeTab === id ? "bg-primary" : "border border-neutral-200 dark:border-white/15"}`}
            >
              <Text
                className={`font-playfair text-xs ${activeTab === id ? "text-white" : "text-neutral-800 dark:text-white/85"}`}
              >
                {FORM_TAB_LABELS[id]}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    ),
    [activeTab],
  );

  const categorySettings = formData.categorySettings || {};

  if (loadingSport) {
    return (
      <OrganizerScreenShell title={mode === "edit" ? "Edit sport configuration" : "Sports configuration"}>
        <View className="items-center py-20">
          <ActivityIndicator color="#1F2B55" />
        </View>
      </OrganizerScreenShell>
    );
  }

  return (
    <OrganizerScreenShell title={mode === "edit" ? "Edit configuration" : "Sports configuration"}>
      <Text className="mb-3 font-playfair text-sm text-neutral-600 dark:text-white/65">
        Configure formats, team rules, categories, and match settings. Choose a catalog sport from your organization
        profile first (same as web).
      </Text>

      {tabBar}

      {activeTab === "basic" ? (
        <View className="gap-3">
          <Text className="font-playfair text-sm text-neutral-700 dark:text-white/80">
            Sport name <Text className="text-red-500">*</Text>
          </Text>
          <Pressable
            onPress={() => mode === "create" && setCatalogModal(true)}
            className="flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5"
          >
            <Text className="font-playfair text-base text-neutral-900 dark:text-white">
              {formData.name || (organizerCatalogSports.length ? "Tap to select sport" : "Add sports on web profile first")}
            </Text>
            {mode === "create" ? <Feather name="chevron-down" size={20} color={isDark ? "#fff" : "#111"} /> : null}
          </Pressable>
          {organizerCatalogSports.length === 0 ? (
            <Text className="text-xs text-amber-700 dark:text-amber-200">
              Save at least one sport under Profile → Organization on the web, then return here.
            </Text>
          ) : null}

          <Text className="mb-1 mt-2 font-playfair text-sm text-neutral-600 dark:text-white/60">Description</Text>
          <TextInput
            value={formData.description}
            onChangeText={(t) => setField("description", t)}
            placeholder="Brief description"
            placeholderTextColor={ph}
            multiline
            textAlignVertical="top"
            className={`min-h-[88px] ${inputClass}`}
          />

          <Text className="mb-1 font-playfair text-sm text-neutral-600 dark:text-white/60">Icon</Text>
          <View className="flex-row items-center gap-3">
            {formData.icon ? (
              <Image source={{ uri: formData.icon }} className="h-16 w-16 rounded-xl" />
            ) : null}
            <Pressable onPress={pickIcon} disabled={uploadingIcon} className="rounded-2xl border border-dashed border-neutral-300 px-4 py-3 dark:border-white/20">
              <Text className="font-playfair text-sm text-primary">{uploadingIcon ? "Uploading…" : "Upload icon"}</Text>
            </Pressable>
            {formData.icon ? (
              <Pressable onPress={() => setField("icon", "")}>
                <Text className="text-sm text-red-500">Remove</Text>
              </Pressable>
            ) : null}
          </View>

          <Text className="mb-1 mt-2 font-playfair text-sm text-neutral-600 dark:text-white/60">Cover image</Text>
          <View className="flex-row items-center gap-3">
            {formData.image ? (
              <Image source={{ uri: formData.image }} className="h-16 w-28 rounded-xl" />
            ) : null}
            <Pressable onPress={pickCover} disabled={uploadingCover} className="rounded-2xl border border-dashed border-neutral-300 px-4 py-3 dark:border-white/20">
              <Text className="font-playfair text-sm text-primary">{uploadingCover ? "Uploading…" : "Upload cover"}</Text>
            </Pressable>
            {formData.image ? (
              <Pressable onPress={() => setField("image", "")}>
                <Text className="text-sm text-red-500">Remove</Text>
              </Pressable>
            ) : null}
          </View>

          <View className="mt-2 flex-row items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3 dark:border-white/10">
            <Text className="font-playfair text-sm text-neutral-800 dark:text-white/90">Featured</Text>
            <Switch value={!!formData.isFeatured} onValueChange={(v) => setField("isFeatured", v)} />
          </View>
        </View>
      ) : null}

      {activeTab === "formats" ? (
        <View className="gap-4">
          {["individual", "doubles", "team"].map((key) => {
            const f = formData.formats[key];
            const labels = { individual: "Individual", doubles: "Doubles", team: "Team" };
            return (
              <View
                key={key}
                className={`rounded-2xl border p-4 ${f.enabled ? "border-primary" : "border-neutral-200 dark:border-white/10"}`}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="font-newsreader-bold text-neutral-900 dark:text-white">{labels[key]}</Text>
                  <Switch value={!!f.enabled} onValueChange={() => toggleFormat(key)} />
                </View>
                {key === "individual" && f.enabled ? (
                  <View className="mt-3 flex-row gap-2">
                    <View className="flex-1">
                      <Text className="mb-1 text-xs text-neutral-500">Min players</Text>
                      <TextInput
                        keyboardType="number-pad"
                        value={String(f.minPlayers)}
                        onChangeText={(t) => setField(`formats.${key}.minPlayers`, parseNum(t, f.minPlayers))}
                        className={inputClass}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="mb-1 text-xs text-neutral-500">Max players</Text>
                      <TextInput
                        keyboardType="number-pad"
                        value={String(f.maxPlayers)}
                        onChangeText={(t) => setField(`formats.${key}.maxPlayers`, parseNum(t, f.maxPlayers))}
                        className={inputClass}
                      />
                    </View>
                  </View>
                ) : null}
                {key === "doubles" && f.enabled ? (
                  <View className="mt-3 flex-row gap-2">
                    <View className="flex-1">
                      <Text className="mb-1 text-xs text-neutral-500">Min players</Text>
                      <TextInput
                        keyboardType="number-pad"
                        value={String(f.minPlayers)}
                        onChangeText={(t) => setField(`formats.${key}.minPlayers`, parseNum(t, f.minPlayers))}
                        className={inputClass}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="mb-1 text-xs text-neutral-500">Max players</Text>
                      <TextInput
                        keyboardType="number-pad"
                        value={String(f.maxPlayers)}
                        onChangeText={(t) => setField(`formats.${key}.maxPlayers`, parseNum(t, f.maxPlayers))}
                        className={inputClass}
                      />
                    </View>
                  </View>
                ) : null}
                {key === "team" && f.enabled ? (
                  <View className="mt-3 gap-2">
                    <View className="flex-row gap-2">
                      <View className="flex-1">
                        <Text className="mb-1 text-xs text-neutral-500">Min team</Text>
                        <TextInput
                          keyboardType="number-pad"
                          value={String(f.minPlayersPerTeam)}
                          onChangeText={(t) => setField(`formats.team.minPlayersPerTeam`, parseNum(t, f.minPlayersPerTeam))}
                          className={inputClass}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="mb-1 text-xs text-neutral-500">Max team</Text>
                        <TextInput
                          keyboardType="number-pad"
                          value={String(f.maxPlayersPerTeam)}
                          onChangeText={(t) => setField(`formats.team.maxPlayersPerTeam`, parseNum(t, f.maxPlayersPerTeam))}
                          className={inputClass}
                        />
                      </View>
                    </View>
                    <View className="flex-row gap-2">
                      <View className="flex-1">
                        <Text className="mb-1 text-xs text-neutral-500">Playing</Text>
                        <TextInput
                          keyboardType="number-pad"
                          value={String(f.playingCount)}
                          onChangeText={(t) => setField(`formats.team.playingCount`, parseNum(t, f.playingCount))}
                          className={inputClass}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="mb-1 text-xs text-neutral-500">Subs</Text>
                        <TextInput
                          keyboardType="number-pad"
                          value={String(f.substitutesCount)}
                          onChangeText={(t) => setField(`formats.team.substitutesCount`, parseNum(t, f.substitutesCount))}
                          className={inputClass}
                        />
                      </View>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {activeTab === "team" ? (
        !formData.formats.team.enabled ? (
          <Text className="font-playfair text-neutral-600 dark:text-white/60">Enable Team under Formats to edit team settings.</Text>
        ) : (
          <View className="gap-4">
            {[
              ["teamSettings.requiresCaptain", "Require captain"],
              ["teamSettings.requiresViceCaptain", "Require vice captain"],
              ["teamSettings.captainCanPlay", "Captain can play"],
            ].map(([path, label]) => (
              <View key={path} className="flex-row items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3 dark:border-white/10">
                <Text className="font-playfair text-sm text-neutral-800 dark:text-white/90">{label}</Text>
                <Switch value={!!getVal(formData, path)} onValueChange={(v) => setField(path, v)} />
              </View>
            ))}
            <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Required member fields</Text>
            <View className="flex-row flex-wrap gap-2">
              {MEMBER_FIELD_OPTIONS.map((opt) => {
                const on = formData.teamSettings.memberRequiredFields.includes(opt.value);
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => toggleMemberField(opt.value)}
                    className={`rounded-full px-3 py-2 ${on ? "bg-primary" : "border border-neutral-200 dark:border-white/15"}`}
                  >
                    <Text className={`font-playfair text-xs ${on ? "text-white" : "text-neutral-800 dark:text-white/85"}`}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Positions</Text>
            <View className="flex-row gap-2">
              <TextInput
                value={newPosition}
                onChangeText={setNewPosition}
                placeholder="e.g. Goalkeeper"
                placeholderTextColor={ph}
                className={`flex-1 ${inputClass}`}
              />
              <Pressable onPress={addPosition} className="justify-center rounded-2xl bg-primary px-4">
                <Feather name="plus" size={22} color="#fff" />
              </Pressable>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {formData.teamSettings.positions.map((pos, idx) => (
                <View key={`${pos}-${idx}`} className="flex-row items-center gap-1 rounded-full bg-neutral-100 px-3 py-1 dark:bg-white/10">
                  <Text className="font-playfair text-sm dark:text-white">{pos}</Text>
                  <Pressable onPress={() => removePosition(idx)}>
                    <Feather name="x" size={16} color="#ef4444" />
                  </Pressable>
                </View>
              ))}
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Text className="mb-1 text-xs text-neutral-500">Jersey min</Text>
                <TextInput
                  keyboardType="number-pad"
                  value={String(formData.teamSettings.jerseyNumberRange.min)}
                  onChangeText={(t) => setField("teamSettings.jerseyNumberRange.min", parseNum(t, formData.teamSettings.jerseyNumberRange.min))}
                  className={inputClass}
                />
              </View>
              <View className="flex-1">
                <Text className="mb-1 text-xs text-neutral-500">Jersey max</Text>
                <TextInput
                  keyboardType="number-pad"
                  value={String(formData.teamSettings.jerseyNumberRange.max)}
                  onChangeText={(t) => setField("teamSettings.jerseyNumberRange.max", parseNum(t, formData.teamSettings.jerseyNumberRange.max))}
                  className={inputClass}
                />
              </View>
            </View>
          </View>
        )
      ) : null}

      {activeTab === "categories" ? (
        <View className="gap-4">
          <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Category fields</Text>
          <View className="gap-2">
            {[
              ["categorySettings.useGender", "Gender"],
              ["categorySettings.useAgeRange", "Age range"],
              ["categorySettings.useSkillLevel", "Skill level"],
              ["categorySettings.useWeightClass", "Weight class"],
            ].map(([path, label]) => (
              <View key={path} className="flex-row items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3 dark:border-white/10">
                <Text className="font-playfair text-sm text-neutral-800 dark:text-white/90">{label}</Text>
                <Switch value={!!getVal(formData, path)} onValueChange={(v) => setField(path, v)} />
              </View>
            ))}
          </View>

          <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Add category</Text>
          <LabeledIconInput icon="tag" label="Name" required value={newCategory.name} onChangeText={(t) => setNewCategory((p) => ({ ...p, name: t }))} />
          <LabeledIconInput icon="hash" label="Code" value={newCategory.code} onChangeText={(t) => setNewCategory((p) => ({ ...p, code: t }))} />
          {categorySettings.useGender ? (
            <Pressable
              onPress={() =>
                setEnumModal({
                  open: true,
                  title: "Gender",
                  options: GENDER_OPTIONS,
                  key: "gender",
                  onPick: (v) => setNewCategory((p) => ({ ...p, gender: v })),
                })
              }
              className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5"
            >
              <Text className="text-xs text-neutral-500">Gender</Text>
              <Text className="font-playfair text-base text-neutral-900 dark:text-white">{newCategory.gender}</Text>
            </Pressable>
          ) : null}
          {categorySettings.useAgeRange ? (
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Text className="mb-1 text-xs text-neutral-500">Min age</Text>
                <TextInput
                  keyboardType="number-pad"
                  value={String(newCategory.minAge)}
                  onChangeText={(t) => setNewCategory((p) => ({ ...p, minAge: t }))}
                  className={inputClass}
                />
              </View>
              <View className="flex-1">
                <Text className="mb-1 text-xs text-neutral-500">Max age</Text>
                <TextInput
                  keyboardType="number-pad"
                  value={String(newCategory.maxAge)}
                  onChangeText={(t) => setNewCategory((p) => ({ ...p, maxAge: t }))}
                  className={inputClass}
                />
              </View>
            </View>
          ) : null}
          {categorySettings.useSkillLevel ? (
            <Pressable
              onPress={() =>
                setEnumModal({
                  open: true,
                  title: "Skill level",
                  options: SKILL_LEVEL_OPTIONS,
                  key: "skill",
                  onPick: (v) => setNewCategory((p) => ({ ...p, skillLevel: v })),
                })
              }
              className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5"
            >
              <Text className="text-xs text-neutral-500">Skill level</Text>
              <Text className="font-playfair text-base text-neutral-900 dark:text-white">{newCategory.skillLevel}</Text>
            </Pressable>
          ) : null}
          {categorySettings.useWeightClass ? (
            <View className="flex-row flex-wrap gap-2">
              <View className="w-[48%]">
                <Text className="mb-1 text-xs text-neutral-500">Min weight</Text>
                <TextInput
                  keyboardType="decimal-pad"
                  value={String(newCategory.minWeight)}
                  onChangeText={(t) => setNewCategory((p) => ({ ...p, minWeight: t }))}
                  className={inputClass}
                />
              </View>
              <View className="w-[48%]">
                <Text className="mb-1 text-xs text-neutral-500">Max weight</Text>
                <TextInput
                  keyboardType="decimal-pad"
                  value={String(newCategory.maxWeight)}
                  onChangeText={(t) => setNewCategory((p) => ({ ...p, maxWeight: t }))}
                  className={inputClass}
                />
              </View>
              <Pressable
                onPress={() =>
                  setEnumModal({
                    open: true,
                    title: "Unit",
                    options: [
                      { value: "kg", label: "kg" },
                      { value: "lbs", label: "lbs" },
                    ],
                    key: "wu",
                    onPick: (v) => setNewCategory((p) => ({ ...p, weightUnit: v })),
                  })
                }
                className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5"
              >
                <Text className="text-xs text-neutral-500">Weight unit</Text>
                <Text className="font-playfair text-base text-neutral-900 dark:text-white">{newCategory.weightUnit}</Text>
              </Pressable>
            </View>
          ) : null}
          <LabeledIconInput
            icon="align-left"
            label="Description"
            value={newCategory.description}
            onChangeText={(t) => setNewCategory((p) => ({ ...p, description: t }))}
          />
          <PrimaryButton title="Add category" onPress={addCategory} />

          <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Categories ({formData.categories.length})</Text>
          {formData.categories.map((cat, index) => (
            <View key={`cat-${index}`} className="rounded-2xl border border-neutral-200 p-3 dark:border-white/10">
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="font-newsreader-bold text-neutral-900 dark:text-white">{cat.name}</Text>
                  {cat.code ? <Text className="text-xs text-neutral-500">{cat.code}</Text> : null}
                </View>
                <Pressable onPress={() => removeCategory(index)}>
                  <Feather name="trash-2" size={18} color="#ef4444" />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {activeTab === "match" ? (
        <View className="gap-3">
          {[
            ["matchSettings.defaultDuration", "Default duration (min)"],
            ["matchSettings.periods", "Periods"],
            ["matchSettings.periodDuration", "Period duration (min)"],
            ["matchSettings.breakDuration", "Break (min)"],
          ].map(([path, label]) => (
            <View key={path}>
              <Text className="mb-1 font-playfair text-sm text-neutral-600 dark:text-white/60">{label}</Text>
              <TextInput
                keyboardType="number-pad"
                value={String(getVal(formData, path))}
                onChangeText={(t) => setField(path, parseNum(t, getVal(formData, path)))}
                className={inputClass}
              />
            </View>
          ))}
          <View className="flex-row items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3 dark:border-white/10">
            <Text className="font-playfair text-sm text-neutral-800 dark:text-white/90">Overtime allowed</Text>
            <Switch
              value={!!formData.matchSettings.overtimeAllowed}
              onValueChange={(v) => setField("matchSettings.overtimeAllowed", v)}
            />
          </View>
          <Text className="mb-1 font-playfair text-sm text-neutral-600 dark:text-white/60">Tiebreaker</Text>
          <TextInput
            value={formData.matchSettings.tieBreaker}
            onChangeText={(t) => setField("matchSettings.tieBreaker", t)}
            placeholder="Optional"
            placeholderTextColor={ph}
            multiline
            className={`min-h-[72px] ${inputClass}`}
          />
          <Pressable
            onPress={() =>
              setEnumModal({
                open: true,
                title: "Scoring type",
                options: SCORING_TYPE_OPTIONS,
                key: "stype",
                onPick: (v) => setField("scoringSystem.type", v),
              })
            }
            className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5"
          >
            <Text className="text-xs text-neutral-500">Scoring type</Text>
            <Text className="font-playfair text-base text-neutral-900 dark:text-white">{formData.scoringSystem.type}</Text>
          </Pressable>
          <LabeledIconInput
            icon="target"
            label="Win condition"
            value={formData.scoringSystem.winCondition}
            onChangeText={(t) => setField("scoringSystem.winCondition", t)}
          />
          <Text className="mb-1 font-playfair text-sm text-neutral-600 dark:text-white/60">Scoring description</Text>
          <TextInput
            value={formData.scoringSystem.description}
            onChangeText={(t) => setField("scoringSystem.description", t)}
            multiline
            placeholderTextColor={ph}
            className={`min-h-[72px] ${inputClass}`}
          />
        </View>
      ) : null}

      {activeTab === "rules" ? (
        <View className="gap-3">
          <Text className="mb-1 font-playfair text-sm text-neutral-600 dark:text-white/60">Rules summary</Text>
          <TextInput
            value={formData.rules.summary}
            onChangeText={(t) => setField("rules.summary", t)}
            multiline
            placeholderTextColor={ph}
            className={`min-h-[88px] ${inputClass}`}
          />
          <Text className="mb-1 font-playfair text-sm text-neutral-600 dark:text-white/60">Detailed rules</Text>
          <TextInput
            value={formData.rules.detailed}
            onChangeText={(t) => setField("rules.detailed", t)}
            multiline
            placeholderTextColor={ph}
            className={`min-h-[120px] ${inputClass}`}
          />
          <LabeledIconInput
            icon="link"
            label="Rules document URL"
            value={formData.rules.documentUrl}
            onChangeText={(t) => setField("rules.documentUrl", t)}
            autoCapitalize="none"
          />
          <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Equipment</Text>
          <View className="flex-row gap-2">
            <TextInput
              value={newEquipment.name}
              onChangeText={(t) => setNewEquipment((p) => ({ ...p, name: t }))}
              placeholder="Item name"
              placeholderTextColor={ph}
              className={`flex-1 ${inputClass}`}
            />
            <View className="justify-center">
              <Switch value={newEquipment.isRequired} onValueChange={(v) => setNewEquipment((p) => ({ ...p, isRequired: v }))} />
            </View>
            <Pressable onPress={addEquipment} className="justify-center rounded-2xl bg-primary px-3">
              <Feather name="plus" size={22} color="#fff" />
            </Pressable>
          </View>
          {formData.equipment.map((eq, index) => (
            <View key={`eq-${index}`} className="flex-row items-center justify-between rounded-xl bg-neutral-100 px-3 py-2 dark:bg-white/10">
              <Text className="font-playfair dark:text-white">
                {eq.name}
                {eq.isRequired ? " (required)" : ""}
              </Text>
              <Pressable onPress={() => removeEquipment(index)}>
                <Feather name="trash-2" size={18} color="#ef4444" />
              </Pressable>
            </View>
          ))}
          <View className="flex-row gap-2">
            <View className="flex-1">
              <LabeledIconInput
                icon="map-pin"
                label="Field / court type"
                value={formData.venueRequirements.fieldType}
                onChangeText={(t) => setField("venueRequirements.fieldType", t)}
              />
            </View>
          </View>
          <LabeledIconInput
            icon="maximize"
            label="Dimensions"
            value={formData.venueRequirements.fieldDimensions}
            onChangeText={(t) => setField("venueRequirements.fieldDimensions", t)}
          />
        </View>
      ) : null}

      <View className="mt-8 flex-row gap-3">
        <View className="flex-1">
          <Pressable
            onPress={goPrev}
            disabled={isFirstStep || submitting}
            className={`items-center rounded-2xl border border-neutral-300 py-3 dark:border-white/25 ${isFirstStep || submitting ? "opacity-50" : ""}`}
          >
            <Text className="font-newsreader-bold text-neutral-900 dark:text-white">Back</Text>
          </Pressable>
        </View>
        {isLastStep ? (
          <View className="flex-1">
            <PrimaryButton title={mode === "edit" ? "Save" : "Save configuration"} isLoading={submitting} onPress={submit} />
          </View>
        ) : (
          <View className="flex-1">
            <PrimaryButton title="Next" onPress={goNext} disabled={submitting} />
          </View>
        )}
      </View>

      <Modal visible={catalogModal} animationType="slide" transparent onRequestClose={() => setCatalogModal(false)}>
        <Pressable className="flex-1 justify-end bg-black/50" onPress={() => setCatalogModal(false)}>
          <View className="max-h-[70%] rounded-t-3xl bg-white dark:bg-[#1F2B55]">
            <Text className="border-b border-neutral-200 px-4 py-3 font-newsreader-bold text-lg dark:border-white/10 dark:text-white">
              Select catalog sport
            </Text>
            <ScrollView className="px-2 py-2">
              {organizerCatalogSports.map((s) => (
                <Pressable
                  key={String(s._id)}
                  onPress={() => pickCatalogSport(s)}
                  className="rounded-xl px-3 py-3 active:bg-neutral-100 dark:active:bg-white/10"
                >
                  <Text className="font-playfair text-base text-neutral-900 dark:text-white">{s.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={enumModal.open} animationType="fade" transparent onRequestClose={() => setEnumModal((m) => ({ ...m, open: false }))}>
        <View className="flex-1 justify-center bg-black/50 px-4">
          <Pressable className="absolute inset-0" onPress={() => setEnumModal((m) => ({ ...m, open: false }))} />
          <View className="max-h-[80%] rounded-2xl bg-white p-4 dark:bg-[#1F2B55]">
            <Text className="mb-3 font-newsreader-bold text-lg text-neutral-900 dark:text-white">{enumModal.title}</Text>
            <ScrollView>
              {enumModal.options?.map((o) => (
                <Pressable
                  key={String(o.value)}
                  onPress={() => {
                    enumModal.onPick(o.value);
                    setEnumModal((m) => ({ ...m, open: false }));
                  }}
                  className="border-b border-neutral-100 py-3 dark:border-white/10"
                >
                  <Text className="font-playfair text-base text-neutral-900 dark:text-white">{o.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </OrganizerScreenShell>
  );
}

function getVal(obj, path) {
  return path.split(".").reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), obj);
}
