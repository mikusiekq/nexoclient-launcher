import React, { useState, useEffect, useRef } from 'react';
import { Smile, Plus, Trash2, Check, Sparkles, Upload, RotateCw, RefreshCw } from 'lucide-react';
import * as skinview3d from 'skinview3d';
import { useLanguage } from '../context/LanguageContext';

interface Skin {
  id: string;
  name: string;
  url: string;
  modelType: 'default' | 'slim';
  createdAt: number;
}

interface SkinsViewProps {
  config: LauncherConfig | null;
  onSaveConfig: (config: LauncherConfig) => Promise<void>;
}

// Helper to render the full player body front view in 2D from skin textures
const SkinBodyPreview: React.FC<{ skinUrl: string; modelType?: 'default' | 'slim' }> = ({ skinUrl, modelType = 'default' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.clearRect(0, 0, 68, 80);
      ctx.imageSmoothingEnabled = false;

      const isSlim = modelType === 'slim';
      const armWidth = isSlim ? 3 : 4;
      const isOldLayout = img.height === 32;

      // Draw Head (8, 8, 8, 8) -> target x=26, y=6, w=16, h=16
      ctx.drawImage(img, 8, 8, 8, 8, 26, 6, 16, 16);
      ctx.drawImage(img, 40, 8, 8, 8, 26, 6, 16, 16); // helm

      // Draw Torso (20, 20, 8, 12) -> target x=26, y=22, w=16, h=24
      ctx.drawImage(img, 20, 20, 8, 12, 26, 22, 16, 24);
      if (!isOldLayout) {
        ctx.drawImage(img, 20, 36, 8, 12, 26, 22, 16, 24); // torso outer
      }

      // Draw Right Leg (0, 20, 4, 12) -> target x=26, y=46, w=8, h=24
      ctx.drawImage(img, 0, 20, 4, 12, 26, 46, 8, 24);
      if (!isOldLayout) {
        ctx.drawImage(img, 0, 36, 4, 12, 26, 46, 8, 24); // right leg outer
      }

      // Draw Left Leg
      if (isOldLayout) {
        // Mirror right leg -> target x=34, y=46
        ctx.save();
        ctx.translate(34 + 8, 46);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 20, 4, 12, 0, 0, 8, 24);
        ctx.restore();
      } else {
        ctx.drawImage(img, 16, 48, 4, 12, 34, 46, 8, 24);
        ctx.drawImage(img, 0, 48, 4, 12, 34, 46, 8, 24); // left leg outer
      }

      // Draw Right Arm (40, 20, 4, 12) -> target x=18/20, y=22
      const rightArmX = isSlim ? 20 : 18;
      const rightArmW = isSlim ? 6 : 8;
      ctx.drawImage(img, 40, 20, armWidth, 12, rightArmX, 22, rightArmW, 24);
      if (!isOldLayout) {
        ctx.drawImage(img, 40, 36, armWidth, 12, rightArmX, 22, rightArmW, 24); // right arm outer
      }

      // Draw Left Arm
      const leftArmX = 42;
      const leftArmW = isSlim ? 6 : 8;
      if (isOldLayout) {
        // Mirror right arm -> target x=42, y=22
        ctx.save();
        ctx.translate(leftArmX + leftArmW, 22);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 40, 20, armWidth, 12, 0, 0, leftArmW, 24);
        ctx.restore();
      } else {
        ctx.drawImage(img, 32, 48, armWidth, 12, leftArmX, 22, leftArmW, 24);
        ctx.drawImage(img, 48, 48, armWidth, 12, leftArmX, 22, leftArmW, 24); // left arm outer
      }
    };
    img.src = skinUrl;
  }, [skinUrl, modelType]);

  return <canvas ref={canvasRef} width={68} height={80} style={{ width: 68, height: 80, imageRendering: 'pixelated' }} />;
};

// Mojang Skin Upload API helper via Electron Main Process (bypassing CORS)
const uploadSkinToMojang = async (token: string, base64DataUrl: string, modelType: 'default' | 'slim') => {
  await window.electronAPI.uploadMojangSkin(token, base64DataUrl, modelType);
};

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const SkinsView: React.FC<SkinsViewProps> = ({ config, onSaveConfig }) => {
  const { t } = useLanguage();
  const skins: Skin[] = config?.skins || [];
  const activeSkinId = config?.activeSkinId || 'default';
  
  const loggedInUsername = config?.account?.username || 'Steve';
  const defaultSkin: Skin = {
    id: 'default',
    name: config?.account?.username ? `${config.account.username} (Domyślny)` : 'Steve (Domyślny)',
    url: `https://minotar.net/skin/${loggedInUsername}`,
    modelType: 'default',
    createdAt: 0
  };

  // Find active skin, fallback to dynamically constructed default skin
  const activeSkin = skins.find(s => s.id === activeSkinId) || defaultSkin;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerRef = useRef<skinview3d.SkinViewer | null>(null);

  // States
  const [animationType, setAnimationType] = useState<'idle' | 'walk' | 'run'>('walk');
  const [autoRotate, setAutoRotate] = useState(true);
  
  // Add skin form states
  const [addMethod, setAddMethod] = useState<'upload' | 'nickname'>('upload');
  const [formName, setFormName] = useState('');
  const [formModelType, setFormModelType] = useState<'default' | 'slim'>('default');
  const [formFileBase64, setFormFileBase64] = useState<string | null>(null);
  const [formNickname, setFormNickname] = useState('');
  const [fetchingNickname, setFetchingNickname] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Currently selected preview skin (shows in left column, does not activate until click Apply)
  const [selectedPreviewSkin, setSelectedPreviewSkin] = useState<Skin>(activeSkin);

  // Sync preview skin with active skin when config first loads or changes
  useEffect(() => {
    setSelectedPreviewSkin(activeSkin);
  }, [activeSkin.id, activeSkin.url, activeSkin.modelType]);

  // Initialize and update SkinViewer on the preview skin
  useEffect(() => {
    if (!canvasRef.current) return;

    // Create viewer
    const viewer = new skinview3d.SkinViewer({
      canvas: canvasRef.current,
      width: 320,
      height: 420,
      skin: selectedPreviewSkin.url
    });

    // Set model type
    viewer.playerObject.skin.modelType = selectedPreviewSkin.modelType;

    // Configure lighting and camera
    viewer.autoRotate = autoRotate;
    viewer.autoRotateSpeed = 0.5;
    viewer.fov = 70;
    viewer.zoom = 0.9;
    
    // Position camera straight (chest level, no tilt)
    viewer.camera.position.x = 0;
    viewer.camera.position.y = 0;
    viewer.camera.position.z = 24;

    viewerRef.current = viewer;

    return () => {
      if (viewerRef.current) {
        viewerRef.current.dispose();
        viewerRef.current = null;
      }
    };
  }, [selectedPreviewSkin.id, selectedPreviewSkin.url, selectedPreviewSkin.modelType]);

  // Handle animations update
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Set speed & auto-rotate
    viewer.autoRotate = autoRotate;

    // Set selected animation
    if (animationType === 'idle') {
      viewer.animation = new skinview3d.IdleAnimation();
    } else if (animationType === 'walk') {
      viewer.animation = new skinview3d.WalkingAnimation();
    } else if (animationType === 'run') {
      viewer.animation = new skinview3d.RunningAnimation();
    } else {
      viewer.animation = null;
    }
  }, [animationType, autoRotate]);

  // Handle equipping/applying the selected preview skin
  const handleApplySkin = async () => {
    if (!config) return;

    setFormError(null);
    setFormSuccess(null);

    const skinToEquip = selectedPreviewSkin;

    if (config.account?.type === 'microsoft' && config.account.token) {
      try {
        setFormSuccess('Ustawianie skina w oficjalnym API Mojang...');
        await uploadSkinToMojang(config.account.token, skinToEquip.url, skinToEquip.modelType);
        setFormSuccess(`Pomyślnie wyposażono skin "${skinToEquip.name}" i zaktualizowano w API Mojang!`);
      } catch (err: any) {
        console.error(err);
        setFormError(`Wyposażono lokalnie, ale nie udało się zaktualizować w API Mojang: ${err.message || err}`);
        setFormSuccess(null);
      }
    } else {
      setFormSuccess(`Pomyślnie wyposażono skin "${skinToEquip.name}" (lokalnie).`);
    }

    await onSaveConfig({
      ...config,
      skins: skins,
      activeSkinId: skinToEquip.id
    });
  };

  // Handle skin deletion
  const handleDelete = async (id: string) => {
    if (!config) return;
    // Don't delete active skin
    if (id === activeSkinId) return;

    const updatedSkins = skins.filter(s => s.id !== id);
    // If deleted custom active skin, fallback active to default
    const nextActive = activeSkinId === id ? 'default' : activeSkinId;

    await onSaveConfig({
      ...config,
      skins: updatedSkins,
      activeSkinId: nextActive
    });
  };

  // Handle file upload selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormError(null);
    setFormSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'image/png') {
      setFormError('Skin musi być plikiem w formacie PNG.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Minecraft skin dimensions check
        const isValidSkin = (img.width === 64 && img.height === 64) || 
                            (img.width === 64 && img.height === 32);
        
        if (!isValidSkin) {
          setFormError(`Niepoprawne wymiary skina: ${img.width}x${img.height}. Wymagane 64x64 lub 64x32 pikseli.`);
          return;
        }

        setFormFileBase64(event.target?.result as string);
        if (!formName) {
          // Pre-fill name from file name
          const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          setFormName(nameWithoutExt.substring(0, 20));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Handle nickname fetch
  const handleFetchNickname = async () => {
    setFormError(null);
    setFormSuccess(null);
    if (!formNickname.trim()) return;

    setFetchingNickname(true);
    try {
      const nick = formNickname.trim();
      const skinUrl = `https://minotar.net/skin/${nick}`;
      
      // Test-fetch to check if user exists/valid
      const res = await fetch(`https://api.ashcon.app/mojang/v2/user/${nick}`);
      if (!res.ok) {
        throw new Error('Gracz o podanym nicku nie istnieje.');
      }
      const data = await res.json();
      const textureUrl = data.textures?.skin?.url;
      const modelType = data.textures?.skin?.slim ? 'slim' : 'default';

      if (!textureUrl) {
        throw new Error('Gracz nie posiada skina.');
      }

      // Convert fetched texture to Base64 instantly for offline availability
      const skinRes = await fetch(skinUrl);
      const skinBlob = await skinRes.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormFileBase64(reader.result as string);
        setFormModelType(modelType);
        if (!formName) {
          setFormName(nick);
        }
        setFormSuccess(`Pomyślnie pobrano skina gracza ${nick}!`);
      };
      reader.readAsDataURL(skinBlob);
    } catch (e: any) {
      console.error(e);
      // Fallback: just use minotar directly anyway if api is down
      const nick = formNickname.trim();
      const skinUrl = `https://minotar.net/skin/${nick}`;
      try {
        const skinRes = await fetch(skinUrl);
        const skinBlob = await skinRes.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormFileBase64(reader.result as string);
          if (!formName) setFormName(nick);
          setFormSuccess(`Zaimportowano skina z Minotar dla gracza ${nick} (brak weryfikacji API).`);
        };
        reader.readAsDataURL(skinBlob);
      } catch (err) {
        setFormError('Nie udało się pobrać skina z serwera Minotar.');
      }
    } finally {
      setFetchingNickname(false);
    }
  };

  // Handle skin addition
  const handleAddSkin = async () => {
    if (!config || !formFileBase64 || !formName.trim()) return;

    const newSkinId = genId();
    const newSkin: Skin = {
      id: newSkinId,
      name: formName.trim().substring(0, 24),
      url: formFileBase64,
      modelType: formModelType,
      createdAt: Date.now()
    };

    const updatedSkins = [...skins, newSkin];

    if (config.account?.type === 'microsoft' && config.account.token) {
      try {
        setFormSuccess('Ustawianie skina w oficjalnym API Mojang...');
        await uploadSkinToMojang(config.account.token, newSkin.url, newSkin.modelType);
        setFormSuccess(`Pomyślnie dodano i ustawiono skin "${newSkin.name}" w API Mojang!`);
      } catch (err: any) {
        console.error(err);
        setFormError(`Dodano skin lokalnie, ale nie udało się zaktualizować w API Mojang: ${err.message || err}`);
        setFormSuccess(null);
      }
    } else {
      setFormSuccess(`Pomyślnie dodano i wyposażono skin "${newSkin.name}" (lokalnie).`);
    }

    await onSaveConfig({
      ...config,
      skins: updatedSkins,
      activeSkinId: newSkinId
    });

    // Auto-select newly added skin in the preview pane
    setSelectedPreviewSkin(newSkin);

    // Reset form states
    setFormName('');
    setFormNickname('');
    setFormFileBase64(null);
  };

  return (
    <div className="skins-view animate-fade-in">
      {/* Page Header */}
      <div className="skins-page-header">
        <div className="skins-header-icon">
          <Smile size={22} />
        </div>
        <div className="skins-header-left">
          <h1 className="skins-title">{t('skins.title')}</h1>
          <span className="skins-subtitle">{t('skins.subtitle')}</span>
        </div>
      </div>

      <div className="skins-content">
        <div className="skins-grid-layout">
          
          {/* Left Column - 3D Viewer */}
          <div className="skins-viewer-panel glass-panel">
            <div className="viewer-title">{t('skins.preview_3d')}</div>
            
            <div className="canvas-container">
              <canvas ref={canvasRef} className="skin-viewer-canvas" />
            </div>

            {/* Viewer Controls */}
            <div className="viewer-controls">
              <div className="control-group">
                <span className="control-label">{t('skins.movement')}</span>
                <div className="anim-toggle-buttons">
                  <button 
                    className={`anim-btn ${animationType === 'idle' ? 'active' : ''}`}
                    onClick={() => setAnimationType('idle')}
                  >
                    {t('skins.idle')}
                  </button>
                  <button 
                    className={`anim-btn ${animationType === 'walk' ? 'active' : ''}`}
                    onClick={() => setAnimationType('walk')}
                  >
                    {t('skins.walk')}
                  </button>
                  <button 
                    className={`anim-btn ${animationType === 'run' ? 'active' : ''}`}
                    onClick={() => setAnimationType('run')}
                  >
                    {t('skins.run')}
                  </button>
                </div>
              </div>

              <button 
                className={`rotate-toggle-btn ${autoRotate ? 'active' : ''}`}
                onClick={() => setAutoRotate(!autoRotate)}
              >
                <RotateCw size={14} className={autoRotate ? 'spin' : ''} />
                <span>{t('skins.auto_rotate')}</span>
              </button>
            </div>

            {/* Apply Button */}
            <div className="viewer-apply-action">
              <button 
                className="apply-skin-btn"
                disabled={activeSkinId === selectedPreviewSkin.id}
                onClick={handleApplySkin}
              >
                {activeSkinId === selectedPreviewSkin.id ? (
                  <>
                    <Check size={15} />
                    <span>{t('skins.equipped')}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    <span>{t('skins.apply')}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column - Controls & Library */}
          <div className="skins-forms-column">
            
            {/* Add Skin Panel */}
            <div className="add-skin-card glass-panel">
              <div className="panel-title">
                <Plus size={16} />
                <span>{t('skins.add_new')}</span>
              </div>

              <div className="add-tabs">
                <button 
                  className={`add-tab ${addMethod === 'upload' ? 'active' : ''}`}
                  onClick={() => { setAddMethod('upload'); setFormError(null); setFormSuccess(null); }}
                >
                  <Upload size={13} />
                  <span>{t('skins.from_computer')}</span>
                </button>
                <button 
                  className={`add-tab ${addMethod === 'nickname' ? 'active' : ''}`}
                  onClick={() => { setAddMethod('nickname'); setFormError(null); setFormSuccess(null); }}
                >
                  <Smile size={13} />
                  <span>{t('skins.by_nickname')}</span>
                </button>
              </div>

              <div className="add-form-body">
                {addMethod === 'upload' ? (
                  <div className="file-drop-zone">
                    <input 
                      type="file" 
                      id="skin-file-input" 
                      accept=".png" 
                      onChange={handleFileChange} 
                      className="hidden-file-input"
                    />
                    <label htmlFor="skin-file-input" className="file-drop-label">
                      <Upload size={24} className="upload-icon" />
                      <div className="drop-title">{t('skins.choose_file')}</div>
                      <div className="drop-sub">{t('skins.dimensions_hint')}</div>
                    </label>
                  </div>
                ) : (
                  <div className="nickname-input-group">
                    <input 
                      className="custom-input"
                      placeholder={t('skins.fetch_nick')}
                      value={formNickname}
                      onChange={e => setFormNickname(e.target.value)}
                    />
                    <button 
                      className="fetch-btn btn-secondary" 
                      onClick={handleFetchNickname}
                      disabled={fetchingNickname || !formNickname.trim()}
                    >
                      {fetchingNickname ? <RefreshCw size={13} className="spin" /> : <span>{t('skins.download')}</span>}
                    </button>
                  </div>
                )}

                {formFileBase64 && (
                  <div className="skin-preview-row animate-fade-in">
                    <div className="preview-texture-container">
                      <img src={formFileBase64} alt="Podgląd tekstury" className="preview-texture-img" />
                    </div>
                    <div className="preview-form-fields">
                      <div className="form-group">
                        <label className="form-label">{t('skins.skin_name')}</label>
                        <input 
                          className="custom-input small-input"
                          placeholder="Nazwij swój skin..."
                          value={formName}
                          onChange={e => setFormName(e.target.value)}
                          maxLength={20}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('skins.model_type')}</label>
                        <div className="model-selector-row">
                          <button 
                            className={`model-btn ${formModelType === 'default' ? 'active' : ''}`}
                            onClick={() => setFormModelType('default')}
                          >
                            {t('skins.classic')}
                          </button>
                          <button 
                            className={`model-btn ${formModelType === 'slim' ? 'active' : ''}`}
                            onClick={() => setFormModelType('slim')}
                          >
                            {t('skins.slim')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {formError && <div className="form-alert error">{formError}</div>}
                {formSuccess && <div className="form-alert success">{formSuccess}</div>}

                <button 
                  className="add-save-btn btn-primary"
                  disabled={!formFileBase64 || !formName.trim()}
                  onClick={handleAddSkin}
                >
                  <Check size={14} />
                  <span>{t('skins.add_new')}</span>
                </button>
              </div>
            </div>

            {/* Skins Library */}
            <div className="skins-library-card glass-panel">
              <div className="panel-title">
                <Sparkles size={15} />
                <span>{t('skins.library')} ({skins.length + 1})</span>
              </div>

              <div className="skins-grid-list">
                {/* Fallback default skin card */}
                <div 
                  className={`skin-card ${selectedPreviewSkin.id === 'default' ? 'previewing' : ''} ${activeSkinId === 'default' ? 'active' : ''}`}
                  onClick={() => setSelectedPreviewSkin(defaultSkin)}
                >
                  {activeSkinId === 'default' && (
                    <div className="active-badge-dot" title="Wyposażony">
                      <Check size={10} />
                    </div>
                  )}
                  <div className="skin-card-preview-wrap">
                    <SkinBodyPreview skinUrl={defaultSkin.url} modelType={defaultSkin.modelType} />
                  </div>
                  <div className="skin-card-name" title={defaultSkin.name}>{defaultSkin.name}</div>
                </div>

                {/* Custom skins */}
                {skins.map(skin => {
                  const isActive = skin.id === activeSkinId;
                  const isPreviewing = skin.id === selectedPreviewSkin.id;
                  return (
                    <div 
                      key={skin.id} 
                      className={`skin-card ${isPreviewing ? 'previewing' : ''} ${isActive ? 'active' : ''}`}
                      onClick={() => setSelectedPreviewSkin(skin)}
                    >
                      {isActive && (
                        <div className="active-badge-dot" title="Wyposażony">
                          <Check size={10} />
                        </div>
                      )}
                      <button 
                        className="skin-card-delete-btn" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(skin.id);
                        }}
                        title="Usuń skin"
                      >
                        <Trash2 size={12} />
                      </button>
                      <div className="skin-card-preview-wrap">
                        <SkinBodyPreview skinUrl={skin.url} modelType={skin.modelType} />
                      </div>
                      <div className="skin-card-name" title={skin.name}>{skin.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>
      </div>

      <style>{`
        .skins-view {
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .skins-page-header {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 20px 24px 16px;
          flex-shrink: 0;
        }

        .skins-header-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-main);
          flex-shrink: 0;
        }

        .skins-header-left {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .skins-title {
          font-family: 'Outfit', sans-serif;
          font-size: 1.6rem;
          font-weight: 800;
          font-style: italic;
          letter-spacing: 0.06em;
          color: var(--text-main);
        }

        .skins-subtitle {
          font-size: 0.78rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        /* Layout */
        .skins-content {
          flex: 1;
          overflow-y: auto;
          padding: 0 24px 24px;
        }

        .skins-grid-layout {
          display: grid;
          grid-template-columns: 340px 1fr;
          gap: 20px;
          height: 100%;
          min-height: 520px;
          align-items: start;
        }

        /* 3D Viewer Panel */
        .skins-viewer-panel {
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          background: rgba(9, 9, 9, 0.85);
          position: relative;
        }

        .viewer-title {
          align-self: flex-start;
          font-family: 'Outfit', sans-serif;
          font-size: 0.95rem;
          font-weight: 800;
          color: var(--text-main);
          letter-spacing: 0.02em;
          margin-bottom: 12px;
        }

        .canvas-container {
          flex: 1;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.02) 0%, rgba(0, 0, 0, 0.3) 100%);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 12px;
          overflow: hidden;
          min-height: 380px;
        }

        .skin-viewer-canvas {
          cursor: grab;
          outline: none;
        }
        .skin-viewer-canvas:active {
          cursor: grabbing;
        }

        .viewer-controls {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 16px;
        }

        .control-group {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          padding: 6px 12px;
        }

        .control-label {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .anim-toggle-buttons {
          display: flex;
          gap: 4px;
        }

        .anim-btn {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 4px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          transition: var(--transition-fast);
        }
        .anim-btn:hover {
          color: var(--text-main);
          background: rgba(255, 255, 255, 0.04);
        }
        .anim-btn.active {
          color: #000000;
          background: #ffffff;
        }

        .rotate-toggle-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 10px;
          font-size: 0.78rem;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          color: var(--text-muted);
          cursor: pointer;
          transition: var(--transition-smooth);
        }
        .rotate-toggle-btn:hover {
          color: var(--text-main);
          border-color: rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.05);
        }
        .rotate-toggle-btn.active {
          color: var(--text-main);
          border-color: rgba(255, 255, 255, 0.25);
          background: rgba(255, 255, 255, 0.08);
          box-shadow: 0 0 12px rgba(255, 255, 255, 0.08);
        }

        .spin {
          animation: spin 3s linear infinite;
        }

        /* Right Column Panels */
        .skins-forms-column {
          display: flex;
          flex-direction: column;
          gap: 16px;
          height: 100%;
        }

        /* Active Skin Banner */
        .active-skin-card {
          padding: 18px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
          background: rgba(9, 9, 9, 0.85);
          overflow: hidden;
          border-radius: 14px;
        }

        .active-card-glow {
          position: absolute;
          inset: 0;
          filter: blur(15px);
          opacity: 0.6;
          z-index: 0;
        }

        .active-skin-details {
          display: flex;
          align-items: center;
          gap: 16px;
          z-index: 1;
        }

        .active-skin-icon-wrap {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .active-label {
          font-size: 0.68rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .active-name {
          font-family: 'Outfit', sans-serif;
          font-size: 1.15rem;
          font-weight: 800;
          color: var(--text-main);
          margin-top: 2px;
        }

        .active-type-badge {
          font-size: 0.68rem;
          color: var(--text-muted);
          font-weight: 500;
          margin-top: 2px;
        }

        .equipped-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 4px 10px;
          border-radius: 20px;
          background: rgba(74, 222, 128, 0.08);
          border: 1px solid rgba(74, 222, 128, 0.2);
          color: #4ade80;
          z-index: 1;
        }

        /* Common panel styling */
        .panel-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: 'Outfit', sans-serif;
          font-size: 0.9rem;
          font-weight: 800;
          color: var(--text-main);
          letter-spacing: 0.02em;
          margin-bottom: 16px;
        }

        /* Add Skin Panel */
        .add-skin-card {
          padding: 20px;
          background: rgba(9, 9, 9, 0.85);
          display: flex;
          flex-direction: column;
        }

        .add-tabs {
          display: flex;
          gap: 2px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          margin-bottom: 16px;
        }

        .add-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: var(--transition-fast);
          margin-bottom: -1px;
        }
        .add-tab:hover {
          color: var(--text-main);
        }
        .add-tab.active {
          color: var(--text-main);
          border-bottom-color: #ffffff;
        }

        .add-form-body {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* Upload drag/drop zone */
        .file-drop-zone {
          border: 2px dashed rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.01);
          border-radius: 10px;
          padding: 24px;
          text-align: center;
          cursor: pointer;
          transition: var(--transition-smooth);
        }
        .file-drop-zone:hover {
          border-color: rgba(255, 255, 255, 0.25);
          background: rgba(255, 255, 255, 0.02);
        }

        .hidden-file-input {
          display: none;
        }

        .file-drop-label {
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
        }

        .upload-icon {
          color: var(--text-muted);
          margin-bottom: 10px;
          opacity: 0.6;
        }

        .drop-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-main);
        }

        .drop-sub {
          font-size: 0.68rem;
          color: var(--text-muted);
          margin-top: 4px;
        }

        /* Nickname fetch input */
        .nickname-input-group {
          display: flex;
          gap: 8px;
          width: 100%;
        }

        .nickname-input-group .custom-input {
          flex: 1;
        }

        .fetch-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 90px;
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: var(--transition-fast);
        }

        /* Preview area */
        .skin-preview-row {
          display: grid;
          grid-template-columns: 80px 1fr;
          gap: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          padding: 14px;
          align-items: start;
        }

        .preview-texture-container {
          width: 80px;
          height: 80px;
          border-radius: 8px;
          overflow: hidden;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .preview-texture-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          image-rendering: pixelated;
        }

        .preview-form-fields {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-label {
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .small-input {
          padding: 6px 10px !important;
          font-size: 0.8rem !important;
        }

        .model-selector-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }

        .model-btn {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 6px;
          border-radius: 5px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: var(--text-muted);
          cursor: pointer;
          transition: var(--transition-fast);
        }
        .model-btn:hover {
          color: var(--text-main);
          border-color: rgba(255, 255, 255, 0.15);
        }
        .model-btn.active {
          color: #000000;
          background: #ffffff;
          border-color: #ffffff;
        }

        .form-alert {
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 0.78rem;
          font-weight: 600;
          border: 1px solid transparent;
        }
        .form-alert.error {
          background: rgba(239, 68, 68, 0.06);
          border-color: rgba(239, 68, 68, 0.15);
          color: #f87171;
        }
        .form-alert.success {
          background: rgba(74, 222, 128, 0.06);
          border-color: rgba(74, 222, 128, 0.15);
          color: #4ade80;
        }

        .add-save-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 11px;
          font-size: 0.85rem;
        }

        /* Skins Library */
        .skins-library-card {
          padding: 20px;
          background: rgba(9, 9, 9, 0.85);
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 250px;
        }

        .skins-grid-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
          gap: 16px;
          overflow-y: auto;
          flex: 1;
          padding-right: 4px;
        }

        .skin-card {
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          cursor: pointer;
          transition: var(--transition-smooth);
          overflow: hidden;
          min-height: 140px;
        }

        .skin-card:hover {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .skin-card.previewing {
          border-color: #ffffff;
          background: rgba(255, 255, 255, 0.04);
          box-shadow: 0 0 12px rgba(255, 255, 255, 0.08);
        }

        .skin-card.active {
          border-color: rgba(74, 222, 128, 0.3);
          background: rgba(74, 222, 128, 0.02);
        }

        .skin-card-preview-wrap {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
        }

        .skin-card-name {
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--text-main);
          width: 100%;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .active-badge-dot {
          position: absolute;
          top: 8px;
          left: 8px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #4ade80;
          color: #000000;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 8px rgba(74, 222, 128, 0.5);
          z-index: 2;
        }

        .skin-card-delete-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 22px;
          height: 22px;
          border-radius: 6px;
          background: rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0;
          transition: var(--transition-fast);
          z-index: 2;
        }

        .skin-card:hover .skin-card-delete-btn {
          opacity: 1;
        }

        .skin-card-delete-btn:hover {
          color: #f87171;
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.4);
        }

        /* Apply Button */
        .viewer-apply-action {
          width: 100%;
          margin-top: 14px;
        }

        .apply-skin-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          font-family: 'Outfit', sans-serif;
          font-size: 0.88rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border-radius: 8px;
          cursor: pointer;
          transition: var(--transition-smooth);
          border: 1px solid #ffffff;
        }

        .apply-skin-btn:not(:disabled) {
          background: #ffffff;
          color: #000000;
        }

        .apply-skin-btn:not(:disabled):hover {
          background: #000000;
          color: #ffffff;
          box-shadow: 0 0 16px rgba(255, 255, 255, 0.25);
        }

        .apply-skin-btn:disabled {
          background: rgba(74, 222, 128, 0.06);
          border-color: rgba(74, 222, 128, 0.2);
          color: #4ade80;
          cursor: not-allowed;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
