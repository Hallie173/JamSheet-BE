const JamProject = require("../models/JamProject");
const AudioTrack = require("../models/AudioTrack");
const cloudinary = require("../config/cloudinary");
const { Readable } = require("stream");
const mongoose = require("mongoose");

exports.checkDuplicateJam = async (req, res) => {
  try {
    const { title } = req.query;
    if (!title) return res.status(400).json({ message: "Thiếu tên nhạc phổ" });

    const existingJam = await JamProject.findOne({
      owner_id: req.user.userId,
      title: { $regex: new RegExp(`^${title}$`, "i") },
    });

    if (existingJam) {
      return res
        .status(200)
        .json({ isDuplicate: true, roomId: existingJam._id });
    }
    res.status(200).json({ isDuplication: false });
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

// [POST] /api/jams
// Chức năng: Tạo một dự án phòng Jam mới
exports.createJamRoom = async (req, res) => {
  try {
    const {
      title,
      tempo,
      time_signature,
      required_instruments,
      sheet_music_id,
    } = req.body;

    // 1. Kiểm tra dữ liệu đầu vào cơ bản
    if (
      !title ||
      !tempo ||
      !required_instruments ||
      required_instruments.length === 0
    ) {
      return res.status(400).json({
        message:
          "Vui lòng điền đầy đủ tên phòng, tempo và ít nhất 1 nhạc cụ yêu cầu!",
      });
    }

    // 2. Khởi tạo Object dự án mới
    const newProject = new JamProject({
      title: title,
      tempo: tempo,
      time_signature: time_signature || "4/4",
      required_instruments: required_instruments,
      owner_id: req.user.userId, // ID người tạo lấy từ token đăng nhập

      // Tạm thời fix cứng 1 ID nhạc phổ để vượt qua vòng kiểm duyệt của Schema
      sheet_music_id: sheet_music_id,

      tracks_config: [], // Phòng mới tinh nên chưa có cấu hình kệ nào
      status: "open",
    });

    // 3. Lưu vào Database
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

    const project = await JamProject.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Không tìm thấy phòng Jam này!" });
    }

    // Lấy tất cả bản thu âm của phòng này
    const publishedTracks = await AudioTrack.find({
      project_id: projectId,
      status: "published",
    }).select("_id name raw_audio_url instrument");

    // Gom nhóm bản thu theo nhạc cụ
    const recordsByInstrument = {};
    publishedTracks.forEach((t) => {
      if (!recordsByInstrument[t.instrument]) {
        recordsByInstrument[t.instrument] = [];
      }
      recordsByInstrument[t.instrument].push({
        id: t._id.toString(),
        name: t.name,
        audioUrl: t.raw_audio_url,
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
      // Nếu phòng đã có người thu âm/cấu hình từ trước
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
      // Nếu là phòng mới tinh vừa tạo
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

    // Đóng gói lại đúng cấu trúc mà Bàn Mixer React đang cần
    const roomData = {
      id: project._id,
      title: project.title,
      tempo: project.tempo,
      timeSignature: project.time_signature,
      tracks: frontendTracks,
    };

    res.status(200).json(roomData);
  } catch (error) {
    console.error("Lỗi lấy thông tin phòng Jam:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// [POST] /api/jams/:id/tracks
// Chức năng: Upload file Audio lên Cloudinary và lưu vào MongoDB
exports.uploadAudioTrack = async (req, res) => {
  try {
    const projectId = req.params.id;
    const { instrument, name, status, duration } = req.body;

    if (!req.file) {
      return res
        .status(400)
        .json({ message: "Vui lòng chọn file audio để upload!" });
    }

    const uploadToCloudinary = (buffer) => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "jamroom_audio",
            resource_type: "video",
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        );
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
    });

    await newTrack.save();

    if (newTrack.status === "published") {
      const project = await JamProject.findById(projectId);
      const trackIndex = project.tracks_config.findIndex(
        (t) => t.instrument === instrument,
      );

      if (trackIndex !== -1) {
        project.tracks_config[trackIndex].active_record_id = newTrack._id;
      } else {
        project.tracks_config.push({
          instrument: instrument,
          volumn: 80,
          active_record_id: newTrack._id,
        });
      }
      await project.save();
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

    if (!track) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy bản thu âm này!" });
    }

    res.status(200).json(track);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

exports.updateAudioTrack = async (req, res) => {
  try {
    const { trackId } = req.params;
    const { status, duration, name, instrument } = req.body;

    const track = await AudioTrack.findById(trackId);
    if (!track) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy bản thu âm này!" });
    }

    if (req.file) {
      const uploadToCloudinary = (buffer) => {
        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: "jamroom_audio",
              resource_type: "video",
            },
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

    if (status) track.status = status;
    if (duration) track.duration = Number(duration);
    if (name) track.name = name;
    if (instrument) track.instrument = instrument;

    await track.save();

    if (track.status === "published") {
      const project = await JamProject.findById(track.project_id);
      
      if (project) {
        const trackIndex = project.tracks_config.findIndex(t => t.instrument === track.instrument);

      if (trackIndex !== -1) {
        project.tracks_config[trackIndex].active_record_id = track._id;
      } else {
        project.tracks_config.push({
          instrument: instrument,
          volumn: 80,
          active_record_id: track._id,
        });
      }
      await project.save();
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

exports.getLobbyJams = async (req, res) => {
  try {
    const userId = req.user.userId;

    // 1. LẤY CÁC PHÒNG DO USER LÀM CHỦ
    const myRooms = await JamProject.find({ owner_id: userId })
      .populate("owner_id", "name avatar")
      .sort({ createdAt: -1 });

    // 2. LẤY CÁC PHÒNG ĐÃ CỘNG TÁC (Có nộp bản thu nhưng không phải chủ phòng)
    // Bước a: Tìm tất cả các bản thu của user này
    const userTracks = await AudioTrack.find({ user_id: userId }).select(
      "project_id",
    );

    // Bước b: Lấy danh sách ID phòng từ các bản thu này
    const projectIds = [
      ...new Set(userTracks.map((t) => t.project_id.toString())),
    ];

    // Bước c: Lấy thông tin các phòng này, nhưng chỉ những phòng mà user không phải chủ
    const collabRooms = await JamProject.find({
      _id: { $in: projectIds },
      owner_id: { $ne: userId },
    })
      .populate("owner_id", "name avatar")
      .sort({ createdAt: -1 });

    // 3. Gộp kết quả và trả về
    res.status(200).json({
      myRooms,
      collabRooms,
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách phòng Jam:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};
