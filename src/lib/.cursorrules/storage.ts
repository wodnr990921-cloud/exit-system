import { createClient } from "@/lib/supabase/client"

export async function uploadFile(
  file: File,
  folder: string = "letters"
): Promise<{ path: string; url: string } | null> {
  try {
    const supabase = createClient()

    // 현재 사용자 확인
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      throw new Error("User not authenticated")
    }

    // 파일을 ArrayBuffer로 변환
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 파일명 생성
    const fileExt = file.name.split(".").pop()
    const fileName = `${user.id}/${Date.now()}-${Math.random()
      .toString(36)
      .substring(7)}.${fileExt}`
    const filePath = `${folder}/${fileName}`

    // Supabase Storage에 업로드
    const { data, error } = await supabase.storage
      .from("letters")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      throw error
    }

    // Public URL 가져오기
    const {
      data: { publicUrl },
    } = supabase.storage.from("letters").getPublicUrl(filePath)

    return {
      path: filePath,
      url: publicUrl,
    }
  } catch (error) {
    console.error("Upload error:", error)
    return null
  }
}
