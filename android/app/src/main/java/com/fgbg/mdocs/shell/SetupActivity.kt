package com.fgbg.mdocs.shell

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class SetupActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_setup)

        val input = findViewById<EditText>(R.id.url_input)
        input.setText(Prefs.getUrl(this).orEmpty())

        findViewById<Button>(R.id.open_button).setOnClickListener {
            val url = normalizeServerUrl(input.text.toString())
            if (url == null) {
                Toast.makeText(this, R.string.setup_invalid, Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            Prefs.setUrl(this, url)
            startActivity(
                Intent(this, MainActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK),
            )
        }
    }
}
