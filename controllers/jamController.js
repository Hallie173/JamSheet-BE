const JamProject = require("../models/JamProject");
const AudioTrack = require("../models/AudioTrack");
const Notification = require("../models/Notification");
const cloudinary = require("../config/cloudinary");
const { Readable } = require("stream");
const mongoose = require("mongoose");
const { partialDeepStrictEqual } = require("assert");

exports.checkDuplicateJam = async (req, res) => {
  try {
    const { title } = req.query;
    if (!title) return res.status(400).json({ message: "Thiếu tên nhạc phổ" });

    const existingJam = await JamProject.findOne({
      owner_id: req.user.userId,
      title: { $regex: new RegExp(`^${title}$`, "i") },
      status: { $ne: "archived" },
    });

    if (existingJam) {
      return res
        .status(200)
        .json({ isDuplicate: true, roomId: existingJam._id });
    }
    res.status(200).json({ isDuplicate: false });
  } catch (error) {
    console.error("Lỗi kiểm tra trùng lặp:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

exports.saveMixConfig = async (req, res) => {
  try {
    const projectId = req.params.id;
    const { tracks_config } = req.body;

    if (!tracks_config || !Array.isArray(tracks_config)) {
      return res
        .status(400)
        .json({ message: "Dữ liệu cấu hình không hợp lệ!" });
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res
        .status(400)
        .json({ message: "ID phòng Jam không đúng chuẩn MongoDB!" });
    }

    const project = await JamProject.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Không tìm thấy phòng Jam này!" });
    }

    if (project.owner_id.toString() !== req.user.userId) {
      return res
        .status(403)
        .json({ message: "Chỉ chủ phòng mới được quyền lưu bản Mix!" });
    }

    project.tracks_config = tracks_config;
    await project.save();

    res.status(200).json({
      message: "Lưu cấu hình Bàn Mixer thành công!",
      tracks_config: project.tracks_config,
    });
  } catch (error) {
    console.error("Lỗi khi lưu cấu hình Mix:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

exports.createJamRoom = async (req, res) => {
  try {
    const {
      title,
      tempo,
      time_signature,
      required_instruments,
      sheet_music_id,
    } = req.body;

    if (
      !title ||
      !tempo ||
      !required_instruments ||
      required_instruments.length === 0
    ) {
      return res
        .status(400)
        .json({
          message:
            "Vui lòng điền đầy đủ tên phòng, tempo và ít nhất 1 nhạc cụ yêu cầu!",
        });
    }

    const newProject = new JamProject({
      title: title,
      tempo: tempo,
      time_signature: time_signature || "4/4",
      required_instruments: required_instruments,
      owner_id: req.user.userId,
      sheet_music_id: sheet_music_id,
      tracks_config: [],
      status: "active",
    });

    await newProject.save();

    res.status(201).json({
      message: "Tạo phòng Jam thành công!",
      room: newProject,
    });
  } catch (error) {
    console.error("Lỗi khi tạo phòng Jam:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

exports.getJamRoomById = async (req, res) => {
  try {
    const projectId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: "ID phòng Jam không hợp lệ!" });
    }

    const project = await JamProject.findById(projectId).populate("sheet_music_id", "file_url file_urls");
    if (!project) {
      return res.status(404).json({ message: "Không tìm thấy phòng Jam này!" });
    }

    const publishedTracks = await AudioTrack.find({
      project_id: projectId,
      status: "published",
    }).select("_id name raw_audio_url instrument sync_offset_ms liked_by");

    const recordsByInstrument = {};
    publishedTracks.forEach((t) => {
      if (!recordsByInstrument[t.instrument]) {
        recordsByInstrument[t.instrument] = [];
      }
      recordsByInstrument[t.instrument].push({
        id: t._id.toString(),
        name: t.name,
        audioUrl: t.raw_audio_url,
        syncOffset: t.sync_offset_ms || 0,
        liked_by: t.liked_by ? t.liked_by.map((id) => id.toString()) : [],
      });
    });

    let frontendTracks = [];
    const colorPalette = [
      "#3b82f6",
      "#10b981",
      "#f59e0b",
      "#ef4444",
      "#8b5cf6",
    ];

    if (project.tracks_config && project.tracks_config.length > 0) {
      frontendTracks = project.tracks_config.map((tc, index) => ({
        id: tc._id || `track_${index}`,
        instrument: tc.instrument,
        user: "Thành viên",
        avatar: "",
        waveColor: colorPalette[index % colorPalette.length],
        volume: tc.volume || 80,
        activeRecordId: tc.active_record_id
          ? tc.active_record_id.toString()
          : null,
        records: recordsByInstrument[tc.instrument] || [],
      }));
    } else if (
      project.required_instruments &&
      project.required_instruments.length > 0
    ) {
      frontendTracks = project.required_instruments.map((inst, index) => ({
        id: `empty_track_${index}`,
        instrument: inst,
        user: "Đang tuyển...",
        avatar: "",
        waveColor: colorPalette[index % colorPalette.length],
        volume: 80,
        activeRecordId: null,
        records: recordsByInstrument[inst] || [],
      }));
    }

    const roomData = {
      id: project._id,
      title: project.title,
      tempo: project.tempo,
      timeSignature: project.time_signature,
      status: project.status,
      sheetUrl: project.sheet_music_id ? project.sheet_music_id.file_url : null,
      sheetUrls: project.sheet_music_id ? project.sheet_music_id.file_urls : [],
      tracks: frontendTracks,
    };

    res.status(200).json(roomData);
  } catch (error) {
    console.error("Lỗi lấy thông tin phòng Jam:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// [PUT] THẢ TIM BẢN THU
exports.toggleLikeTrack = async (req, res) => {
  try {
    const { trackId } = req.params;
    const userId = req.user.userId;
    const track = await AudioTrack.findById(trackId);
    if (!track) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy bản thu!" });
    };

    const likedIndex = track.liked_by.indexOf(userId);

    if (likedIndex === -1) {
      track.liked_by.push(userId);
    } else {
      track.liked_by.splice(likedIndex, 1);
    }

    track.likes_count = track.liked_by.length;
    await track.save();

    // BẮN THÔNG BÁO (Nếu là Thích và người thích khác chủ bản thu)
    if (likedIndex === -1 && track.user_id.toString() !== userId) {
      const Notification = require("../models/Notification");
      
      // LOGIC GỘP (UPSERT): Tìm xem có thông báo chưa đọc của track này không
      const existingNotif = await Notification.findOne({
        recipient_id: track.user_id,
        type: "track_likes",
        target_id: track._id,
        is_read: false
      });

      if (existingNotif) {
        existingNotif.count += 1; // Cộng dồn số like
        await existingNotif.save();
      } else {
        await Notification.create({
          recipient_id: track.user_id,
          type: "track_likes",
          target_id: track._id,
          target_name: track.name,
          target_link: `/jam-room?id=${track.project_id}`,
          count: 1
        });
      }
    }

    res.status(200).json({
      message: likedIndex === -1 ? "Đã thích bản thu!" : "Đã bỏ thích bản thu!",
      likes_count: track.likes_count,
      liked_by: track.liked_by,
    });
  } catch (error) {
    console.error("Lỗi khi thả tim bản thu:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// [POST] TẠO MỚI BẢN THU (Kèm bắt Offset và AI)
exports.uploadAudioTrack = async (req, res) => {
  try {
    const projectId = req.params.id;
    const { instrument, name, status, duration, sync_offset_ms, use_ai_clean } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Vui lòng chọn file audio để upload!" });
    }

    const uploadToCloudinary = (buffer) => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "jamroom_audio", resource_type: "video" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        const { Readable } = require("stream");
        Readable.from(buffer).pipe(uploadStream);
      });
    };

    const cloudResult = await uploadToCloudinary(req.file.buffer);

    const newTrack = new AudioTrack({
      project_id: projectId,
      user_id: req.user.userId,
      instrument: instrument,
      name: name || `Take nháp - ${new Date().toLocaleTimeString()}`,
      raw_audio_url: cloudResult.secure_url,
      duration: Number(duration) || 0,
      status: status || "draft",
      sync_offset_ms: Number(sync_offset_ms) || 0,
      ai_status: use_ai_clean === "true" ? "pending" : "none",
    });

    await newTrack.save();

    if (newTrack.status === "published") {
      const project = await JamProject.findById(projectId);
      if (project) {
        const trackIndex = project.tracks_config.findIndex(
          (t) => t.instrument === instrument,
        );

        if (trackIndex !== -1) {
          project.tracks_config[trackIndex].active_record_id = newTrack._id;
        } else {
          project.tracks_config.push({
            instrument: instrument,
            volume: 80,
            active_record_id: newTrack._id,
          });
        }
        await project.save();

        // ---- LOGIC BẮN THÔNG BÁO PHÒNG JAM (Đã bọc thép an toàn) ----
        try {
          const Notification = require("../models/Notification");
          const currentUserIdStr = req.user.userId.toString();
          
          // Kiểm tra an toàn xem phòng có owner_id không
          const ownerIdStr = project.owner_id ? project.owner_id.toString() : "";

          // 1. Gửi cho Chủ Phòng (nếu người up không phải chủ phòng)
          if (ownerIdStr && ownerIdStr !== currentUserIdStr) {
            await Notification.create({
              recipient_id: project.owner_id,
              type: "room_new_track_owner",
              target_id: project._id,
              target_name: project.title,
              target_link: `/jam-room?id=${project._id}`
            });
          }

          // 2. Gửi cho các Nhạc công khác đang tham gia phòng
          const allTracks = await AudioTrack.find({ project_id: projectId, status: "published" }).distinct("user_id");
          
          const participants = allTracks.filter(uid => {
            if (!uid) return false; // Bỏ qua nếu dữ liệu rác không có user_id
            const uidStr = uid.toString();
            // Không tự gửi cho chính mình & Không gửi trùng 2 lần cho chủ phòng
            return uidStr !== currentUserIdStr && uidStr !== ownerIdStr;
          });

          for (const pId of participants) {
            await Notification.findOneAndUpdate(
              { recipient_id: pId, type: "room_new_track_participant", target_id: project._id, is_read: false },
              {
                target_name: project.title,
                target_link: `/jam-room?id=${project._id}`,
                updatedAt: Date.now() // Cập nhật lại thời gian thông báo
              },
              { upsert: true, new: true }
            );
          }
        } catch (notifError) {
          // Ghi lỗi ra console nhưng KHÔNG làm chết quá trình upload của người dùng
          console.error("Lỗi khi bắn thông báo phòng Jam:", notifError);
        }
      }
    }

    res.status(201).json({
      message: "Tải lên bản thu âm thành công!",
      track: newTrack,
    });
  } catch (error) {
    console.error("Lỗi khi upload bản thu âm:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

exports.getMyTracks = async (req, res) => {
  try {
    const tracks = await AudioTrack.find({ user_id: req.user.userId })
      .populate("project_id", "title")
      .sort({ createdAt: -1 });
    res.status(200).json(tracks);
  } catch (error) {
    console.error("Lỗi khi lấy danh sách bản thu âm của tôi:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

exports.getTrackById = async (req, res) => {
  try {
    const trackId = req.params.trackId;
    const track = await AudioTrack.findById(trackId).populate("project_id");
    if (!track)
      return res
        .status(404)
        .json({ message: "Không tìm thấy bản thu âm này!" });
    res.status(200).json(track);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// [PUT] CẬP NHẬT BẢN NHÁP VÀ XUẤT BẢN
exports.updateAudioTrack = async (req, res) => {
  try {
    const { trackId } = req.params;
    const { status, duration, name, instrument, sync_offset_ms, use_ai_clean } = req.body;

    const track = await AudioTrack.findById(trackId);
    if (!track) {
      return res.status(404).json({ message: "Không tìm thấy bản thu âm này!" });
    }

    // Nếu có file âm thanh mới tải lên thay thế
    if (req.file) {
      const uploadToCloudinary = (buffer) => {
        return new Promise((resolve, reject) => {
          const cloudinary = require("../config/cloudinary");
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: "jamroom_audio", resource_type: "video" },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            },
          );
          require("stream").Readable.from(buffer).pipe(uploadStream);
        });
      };
      const cloudResult = await uploadToCloudinary(req.file.buffer);
      track.raw_audio_url = cloudResult.secure_url;
    }

    // CHỐT CHẶN THÔNG MINH: Lưu lại trạng thái CŨ trước khi cập nhật
    const oldStatus = track.status;

    if (status) track.status = status;
    if (duration) track.duration = Number(duration);
    if (name) track.name = name;
    if (instrument) track.instrument = instrument;

    if (sync_offset_ms !== undefined) track.sync_offset_ms = Number(sync_offset_ms);
    if (use_ai_clean === "true") track.ai_status = "pending";
    else if (use_ai_clean === "false") track.ai_status = "none";

    await track.save();

    // KIỂM TRA: Chỉ xử lý đưa lên kệ và bắn thông báo khi track là "published"
    if (track.status === "published") {
      const project = await JamProject.findById(track.project_id);

      if (project) {
        const trackIndex = project.tracks_config.findIndex(
          (t) => t.instrument === track.instrument,
        );

        // Đưa track lên kệ của Mixer
        if (trackIndex !== -1) {
          project.tracks_config[trackIndex].active_record_id = track._id;
        } else {
          project.tracks_config.push({
            instrument: track.instrument,
            volume: 80,
            active_record_id: track._id,
          });
        }
        await project.save();

        // CHỈ BẮN THÔNG BÁO NẾU ĐÂY LÀ LẦN ĐẦU TIÊN XUẤT BẢN (Từ draft -> published)
        if (oldStatus !== "published") {
          try {
            const Notification = require("../models/Notification");
            const currentUserIdStr = req.user.userId.toString();
            const ownerIdStr = project.owner_id ? project.owner_id.toString() : "";

            // 1. Gửi thông báo cho Chủ Phòng
            if (ownerIdStr && ownerIdStr !== currentUserIdStr) {
              await Notification.create({
                recipient_id: project.owner_id,
                type: "room_new_track_owner",
                target_id: project._id,
                target_name: project.title,
                target_link: `/jam-room?id=${project._id}`
              });
            }

            // 2. Gửi thông báo cho các Nhạc công khác trong phòng
            const allTracks = await AudioTrack.find({ project_id: track.project_id, status: "published" }).distinct("user_id");

            const participants = allTracks.filter(uid => {
              if (!uid) return false;
              const uidStr = uid.toString();
              return uidStr !== currentUserIdStr && uidStr !== ownerIdStr;
            });

            for (const pId of participants) {
              await Notification.findOneAndUpdate(
                { recipient_id: pId, type: "room_new_track_participant", target_id: project._id, is_read: false },
                {
                  target_name: project.title,
                  target_link: `/jam-room?id=${project._id}`,
                  updatedAt: Date.now()
                },
                { upsert: true, new: true }
              );
            }
          } catch (notifError) {
            console.error("Lỗi khi bắn thông báo phòng Jam (lúc update):", notifError);
          }
        }
      }
    }

    res.status(200).json({
      message: "Cập nhật bản thu âm thành công!",
      track,
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật bản thu âm:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// [DELETE] XÓA BẢN THU
exports.deleteTrack = async (req, res) => {
  try {
    const trackId = req.params.trackId;
    const userId = req.user.userId;

    const track = await AudioTrack.findById(trackId);
    if (!track) {
      return res.status(404).json({ message: "Track không tồn tại!" });
    }
    if (track.user_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn không có quyền xóa track này!" });
    }

    const trackCount = await AudioTrack.countDocuments({ project_id: track.project_id });

    if (trackCount === 1) {
      // Nếu là track duy nhất, archive project
      await JamProject.findByIdAndUpdate(track.project_id, { status: "archived" });
      await AudioTrack.findByIdAndDelete(trackId);
      res.status(200).json({ message: "Track đã được xóa và project đã được lưu trữ vì là track duy nhất!", action: "delete_and_archive" });
    } else {
      // Nếu có track khác, chỉ xóa track
      await AudioTrack.findByIdAndDelete(trackId);
      res.status(200).json({ message: "Track đã được xóa!", action: "delete" });
    }
  } catch (error) {
    console.error("Lỗi khi xóa track:", error);
    res.status(500).json({
      message: "Lỗi server khi xóa track",
      error: error.message,
    });
  }
};

exports.getLobbyJams = async (req, res) => {
  try {
    const userId = req.user.userId;

    const myRooms = await JamProject.find({ owner_id: userId })
      .populate("owner_id", "name avatar")
      .sort({ createdAt: -1 });

    const userTracks = await AudioTrack.find({ user_id: userId }).select(
      "project_id",
    );
    const projectIds = [
      ...new Set(userTracks.map((t) => t.project_id.toString())),
    ];

    const collabRooms = await JamProject.find({
      _id: { $in: projectIds },
      owner_id: { $ne: userId },
    })
      .populate("owner_id", "name avatar")
      .sort({ createdAt: -1 });

    res.status(200).json({ myRooms, collabRooms });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách phòng Jam:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

exports.findJamBySheetId = async (req, res) => {
  try {
    const { sheetId } = req.params;
    
    // Tìm phòng Jam mới nhất (sắp xếp theo createdAt giảm dần) đang xài sheet_id này
    const jamRoom = await JamProject.findOne({ sheet_music_id: sheetId })
                                    .sort({ createdAt: -1 });

    if (jamRoom) {
      res.status(200).json({ roomId: jamRoom._id });
    } else {
      res.status(200).json({ roomId: null });
    }
  } catch (error) {
    console.error("Lỗi khi tìm phòng Jam theo Sheet:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

exports.getTopTracks = async (req, res) => {
  try {
    const topTracks = await AudioTrack.find({ status: "published" })
      .populate("project_id", "title")
      .sort({ likes_count: -1, createdAt: -1 })
      .limit(8);

    res.status(200).json(topTracks);
  } catch (error) {
    console.error("Lỗi khi lấy danh sách bản thu âm nổi bật:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

exports.getRecentDrafts = async (req, res) => {
  try {
    const userId = req.user.userId;

    const drafts = await AudioTrack.find({ user_id: userId, status: "draft" })
      .populate("project_id", "title")
      .sort({ createdAt: -1 })
      .limit(3);

    const validDrafts = drafts.filter(draft => draft.project_id != null);

    const formattedDrafts = validDrafts.map((draft) => ({
      id: draft.project_id._id,
      draftId: draft._id,
      title: draft.project_id.title || "Phòng Jam có thể đã bị xóa",
      role: draft.instrument,
      lastActive: draft.updatedAt,
    }));

    res.status(200).json(formattedDrafts);
  } catch (error) {
    console.error("Lỗi khi lấy danh sách bản nháp gần đây:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

exports.getTrendingJams = async (req, res) => {
  try {
    const allJams = await JamProject.find().populate("owner_id", "name");
    
    const trendingJams = [];

    for (const jam of allJams) {
      const requiredCount = jam.required_instruments.length;
      if (requiredCount === 0) continue;

      const publishedCount = await AudioTrack.find({
        project_id: jam._id,
        status: "published",
      }).distinct("instrument");

      const filledCount = publishedCount.length;

      if (filledCount >= requiredCount) {
        const allTracksInRoom = await AudioTrack.find({
          project_id: jam._id,
          status: "published",
        });
        const totalLikes = allTracksInRoom.reduce(
          (sum, t) => sum + (t.likes_count || 0),
          0,
        );

        trendingJams.push({
          id: jam._id,
          title: jam.title,
          creator: jam.owner_id ? jam.owner_id.name : "Unknown",
          likes: totalLikes,
          participants: filledCount,
          tags: ["Hoàn thành"],
        });
      }
    }

    trendingJams.sort((a, b) => b.likes - a.likes);
    const topTrending = trendingJams.slice(0, 6);
    res.status(200).json(topTrending);
  } catch (error) {
    console.error("Lỗi khi lấy danh sách phòng Jam thịnh hành:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// [DELETE] XÓA BẢN THU ÂM
exports.deleteTrack = async (req, res) => {
  try {
    // Tương thích với cả route dùng /:id hoặc /:trackId
    const trackId = req.params.id || req.params.trackId; 
    const userId = req.user.userId;

    const track = await AudioTrack.findById(trackId);
    if (!track) {
      return res.status(404).json({ message: "Không tìm thấy bản thu!" });
    }

    // Kiểm tra quyền (Chỉ chủ bản thu mới được xóa)
    if (track.user_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn không có quyền xóa bản thu này!" });
    }

    // Tiến hành xóa khỏi Database
    await AudioTrack.findByIdAndDelete(trackId);

    // Dọn dẹp: Nếu bản thu này đang được chọn trên kệ (Mixer) thì gỡ nó xuống
    if (track.project_id) {
      const JamProject = require("../models/JamProject");
      const project = await JamProject.findById(track.project_id);
      if (project) {
        let isChanged = false;
        project.tracks_config.forEach(tc => {
          if (tc.active_record_id && tc.active_record_id.toString() === trackId) {
            tc.active_record_id = null; // Gỡ khỏi kệ
            isChanged = true;
          }
        });
        if (isChanged) await project.save();
      }
    }

    res.status(200).json({ message: "Đã xóa bản thu thành công!" });
  } catch (error) {
    console.error("Lỗi khi xóa bản thu:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};